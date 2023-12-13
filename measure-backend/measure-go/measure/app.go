package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"measure-backend/measure-go/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const queryGetApp = `
select
  apps.app_name,
  apps.unique_identifier,
  apps.platform,
  apps.first_version,
  apps.latest_version,
  apps.first_seen_at,
  apps.onboarded,
  apps.onboarded_at,
  api_keys.key_prefix,
  api_keys.key_value,
  api_keys.checksum,
  api_keys.last_seen,
  api_keys.created_at,
  apps.created_at,
  apps.updated_at
from apps
left outer join api_keys on api_keys.app_id = apps.id
where apps.id = $1 and apps.team_id = $2;
`

type App struct {
	ID            uuid.UUID `json:"id"`
	TeamId        uuid.UUID `json:"team_id"`
	AppName       string    `json:"name" binding:"required"`
	UniqueId      string    `json:"unique_identifier"`
	Platform      string    `json:"platform"`
	APIKey        *APIKey   `json:"api_key"`
	firstVersion  string    `json:"first_version"`
	latestVersion string    `json:"latest_version"`
	firstSeenAt   time.Time `json:"first_seen_at"`
	Onboarded     bool      `json:"onboarded"`
	OnboardedAt   time.Time `json:"onboarded_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (a App) MarshalJSON() ([]byte, error) {
	type Alias App
	return json.Marshal(&struct {
		*Alias
		Platform    *string    `json:"platform"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
	}{
		Platform: func() *string {
			if a.Platform == "" {
				return nil
			}
			return &a.Platform
		}(),
		UniqueId: func() *string {
			if a.UniqueId == "" {
				return nil
			}
			return &a.UniqueId
		}(),
		OnboardedAt: func() *time.Time {
			if a.OnboardedAt.IsZero() {
				return nil
			}
			return &a.OnboardedAt
		}(),
		Alias: (*Alias)(&a),
	})
}

func NewApp(teamId uuid.UUID) *App {
	now := time.Now()
	return &App{
		ID:        uuid.New(),
		TeamId:    teamId,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func (a *App) add() (*APIKey, error) {
	a.ID = uuid.New()
	tx, err := server.Server.PgPool.Begin(context.Background())

	if err != nil {
		return nil, err
	}

	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(), "insert into public.apps(id, team_id, app_name, created_at, updated_at) values ($1, $2, $3, $4, $5);", a.ID, a.TeamId, a.AppName, a.CreatedAt, a.UpdatedAt)

	if err != nil {
		return nil, err
	}

	apiKey, err := NewAPIKey(a.ID)

	if err != nil {
		return nil, err
	}

	if err := apiKey.saveTx(tx, a); err != nil {
		return nil, err
	}

	if err := tx.Commit(context.Background()); err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (a *App) get(id uuid.UUID) (*App, error) {
	var appName pgtype.Text
	var uniqueId pgtype.Text
	var platform pgtype.Text
	var firstVersion pgtype.Text
	var latestVersion pgtype.Text
	var firstSeenAt pgtype.Timestamptz
	var onboarded pgtype.Bool
	var onboardedAt pgtype.Timestamptz
	var apiKeyLastSeen pgtype.Timestamptz
	var apiKeyCreatedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var updatedAt pgtype.Timestamptz

	apiKey := new(APIKey)

	if err := server.Server.PgPool.QueryRow(context.Background(), queryGetApp, id, a.TeamId).Scan(&appName, &uniqueId, &platform, &firstVersion, &latestVersion, &firstSeenAt, &onboarded, &onboardedAt, &apiKey.keyPrefix, &apiKey.keyValue, &apiKey.checksum, &apiKeyLastSeen, &apiKeyCreatedAt, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if appName.Valid {
		a.AppName = appName.String
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	} else {
		a.UniqueId = ""
	}

	if platform.Valid {
		a.Platform = platform.String
	} else {
		a.Platform = ""
	}

	if firstVersion.Valid {
		a.firstVersion = firstVersion.String
	} else {
		a.firstVersion = ""
	}

	if onboarded.Valid {
		a.Onboarded = onboarded.Bool
	}

	if latestVersion.Valid {
		a.latestVersion = latestVersion.String
	} else {
		a.latestVersion = ""
	}

	if firstSeenAt.Valid {
		a.firstSeenAt = firstSeenAt.Time
	}

	if onboardedAt.Valid {
		a.OnboardedAt = onboardedAt.Time
	}

	if apiKeyLastSeen.Valid {
		apiKey.lastSeen = apiKeyLastSeen.Time
	}

	if apiKeyCreatedAt.Valid {
		apiKey.createdAt = apiKeyCreatedAt.Time
	}

	if createdAt.Valid {
		a.CreatedAt = createdAt.Time
	}

	if updatedAt.Valid {
		a.UpdatedAt = updatedAt.Time
	}

	a.APIKey = apiKey

	return a, nil
}

func GetAppJourney(c *gin.Context) {
	var af AppFilter

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	af.AppID = id

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app journey request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	if !af.hasVersion() {
		af.setDefaultVersion()
	}

	// fmt.Println("journey request app id", af.AppID)
	// fmt.Println("journey request from", af.From)
	// fmt.Println("journey request to", af.To)
	// fmt.Println("journey request version", af.Version)

	data1 := `{"nodes":[{"id":"Home Screen","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order History","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order Status","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Support","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"List Of Items","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Sales Offer","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Images","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Detail","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Cyber Monday Sale Items List","nodeColor":"hsl(0, 72%, 51%)","issues":{"crashes":[{"title":"NullPointerException.java","count":37893},{"title":"LayoutInflaterException.java","count":12674}],"anrs":[{"title":"CyberMondayActivity.java","count":97321},{"title":"CyberMondayFragment.kt","count":8005}]}},{"id":"Add To Cart","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Pay","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Explore Discounts","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}}],"links":[{"source":"Home Screen","target":"Order History","value":50000},{"source":"Home Screen","target":"List Of Items","value":73356},{"source":"Home Screen","target":"Cyber Monday Sale Items List","value":97652},{"source":"Order History","target":"Order Status","value":9782},{"source":"Order History","target":"Support","value":2837},{"source":"List Of Items","target":"Sales Offer","value":14678},{"source":"List Of Items","target":"View Item Detail","value":23654},{"source":"Cyber Monday Sale Items List","target":"View Item Detail","value":43889},{"source":"Cyber Monday Sale Items List","target":"Explore Discounts","value":34681},{"source":"Sales Offer","target":"View Item Images","value":12055},{"source":"View Item Detail","target":"View Item Images","value":16793},{"source":"View Item Detail","target":"Add To Cart","value":11537},{"source":"Add To Cart","target":"Pay","value":10144},{"source":"Add To Cart","target":"Explore Discounts","value":4007}]}`

	data2 := `{"nodes":[{"id":"Home Screen","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order History","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Order Status","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Support","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"List Of Items","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Sales Offer","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Images","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"View Item Detail","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Cyber Monday Sale Items List","nodeColor":"hsl(0, 72%, 51%)","issues":{"crashes":[{"title":"NullPointerException.java","count":32893},{"title":"LayoutInflaterException.java","count":12874}],"anrs":[{"title":"CyberMondayActivity.java","count":77321},{"title":"CyberMondayFragment.kt","count":6305}]}},{"id":"Add To Cart","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Pay","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}},{"id":"Explore Discounts","nodeColor":"hsl(142, 69%, 58%)","issues":{"crashes":[],"anrs":[]}}],"links":[{"source":"Home Screen","target":"Order History","value":60000},{"source":"Home Screen","target":"List Of Items","value":53356},{"source":"Home Screen","target":"Cyber Monday Sale Items List","value":96652},{"source":"Order History","target":"Order Status","value":9822},{"source":"Order History","target":"Support","value":2287},{"source":"List Of Items","target":"Sales Offer","value":12628},{"source":"List Of Items","target":"View Item Detail","value":53254},{"source":"Cyber Monday Sale Items List","target":"View Item Detail","value":43889},{"source":"Cyber Monday Sale Items List","target":"Explore Discounts","value":34681},{"source":"Sales Offer","target":"View Item Images","value":12055},{"source":"View Item Detail","target":"View Item Images","value":12793},{"source":"View Item Detail","target":"Add To Cart","value":16537},{"source":"Add To Cart","target":"Pay","value":10144},{"source":"Add To Cart","target":"Explore Discounts","value":3007}]}`

	var data string
	randomInt := rand.Intn(100)
	if randomInt > 70 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API server is experiencing intermittent issues"})
		return
	}
	if randomInt%2 == 0 {
		data = data1
	} else {
		data = data2
	}

	c.Data(http.StatusOK, "application/json", []byte(data))
}

func GetAppMetrics(c *gin.Context) {
	var af AppFilter

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	af.AppID = id

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := af.validate(); err != nil {
		msg := "app journey request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if !af.hasTimeRange() {
		af.setDefaultTimeRange()
	}

	if !af.hasVersion() {
		af.setDefaultVersion()
	}

	// fmt.Println("journey request app id", af.AppID)
	// fmt.Println("journey request from", af.From)
	// fmt.Println("journey request to", af.To)
	// fmt.Println("journey request version", af.Version)

	data1 := `{"adoption":{"users":40000,"totalUsers":200000,"value":20},"app_size":{"value":20,"delta":3.18},"crash_free_users":{"value":98.5,"delta":0.73},"perceived_crash_free_users":{"value":91.3,"delta":-0.51},"multiple_crash_free_users":{"value":76.37,"delta":0.62},"anr_free_users":{"value":98.5,"delta":0.73},"perceived_anr_free_users":{"value":91.3,"delta":0.27},"multiple_anr_free_users":{"value":97.88,"delta":-3.13},"app_cold_launch":{"value":937,"delta":34},"app_warm_launch":{"value":600,"delta":-87},"app_hot_launch":{"value":250,"delta":-55}}`
	data2 := `{"adoption":{"users":49000,"totalUsers":200000,"value":28},"app_size":{"value":20,"delta":3.18},"crash_free_users":{"value":98.2,"delta":0.71},"perceived_crash_free_users":{"value":92.8,"delta":-0.81},"multiple_crash_free_users":{"value":75.49,"delta":0.38},"anr_free_users":{"value":98.3,"delta":0.43},"perceived_anr_free_users":{"value":91.9,"delta":0.77},"multiple_anr_free_users":{"value":97.26,"delta":-2.85},"app_cold_launch":{"value":900,"delta":-200},"app_warm_launch":{"value":600,"delta":-127},"app_hot_launch":{"value":300,"delta":-50}}`

	var data string
	randomInt := rand.Intn(100)
	if randomInt > 70 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "API server is experiencing intermittent issues"})
		return
	}
	if randomInt%2 == 0 {
		data = data1
	} else {
		data = data2
	}

	c.Data(http.StatusOK, "application/json", []byte(data))
}

func GetAppFilters(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	appFiltersMap := map[string]string{
		"59ba1c7f-2a42-4b7f-b9cb-735d25146675": `{
			"version": ["13.2.1", "13.2.2", "13.3.7"],
			"country": [
			  {
				"code": "IN",
				"name": "India"
			  },
			  {
				"code": "CN",
				"name": "China"
			  },
			  {
				"code": "US",
				"name": "USA"
			  }
			],
			"network_provider": ["Airtel", "Jio", "Vodafone"],
			"network_type": ["WiFi", "5G", "4G", "3G", "2G", "Edge"],
			"locale": ["en_IN", "en_US", "en_UK"],
			"device_manufacturer": ["Samsung", "Huawei", "Motorola"],
			"device_name": ["Samsung Galaxy Note 2", "Motorola Razor V2", "Huawei P30 Pro"]
		  }`,
		"243f3214-0f41-4361-8ef3-21d8f5d99a70": `{
			"version": ["13.2.1", "13.2.2", "13.3.9", "13.3.10"],
			"country": [
			  {
				"code": "IN",
				"name": "India"
			  },
			  {
				"code": "CN",
				"name": "China"
			  },
			  {
				"code": "US",
				"name": "USA"
			  }
			],
			"network_provider": ["Airtel", "Jio", "Vodafone"],
			"network_type": ["WiFi", "4G", "3G", "2G"],
			"locale": ["en_IN", "en_US", "en_UK", "zh_HK"],
			"device_manufacturer": ["Samsung", "Huawei", "Motorola"],
			"device_name": ["Samsung Galaxy Note 2", "Motorola Razor V2", "Huawei P30 Pro"]
		  }`,
		"bae4fb9e-07cd-4435-a42e-d99986830c2c": `{
			"version": ["13.3.9", "13.3.12"],
			"country": [
			  {
				"code": "IN",
				"name": "India"
			  },
			  {
				"code": "CN",
				"name": "China"
			  }
			],
			"network_provider": ["Airtel", "Jio", "Vodafone"],
			"network_type": ["WiFi", "4G", "2G"],
			"locale": ["en_IN", "en_UK", "zh_HK"],
			"device_manufacturer": ["Samsung", "Huawei", "Lenovo"],
			"device_name": ["Samsung Galaxy Note 2", "Lenovo Legion Y90", "Huawei P30 Pro"]
		  }`,
		"c6643110-d3e5-4b1c-bfcc-75b46b52ae79": `{
			"version": ["2.2.1", "2.3.2", "3.1.0"],
			"country": [
			  {
				"code": "IT",
				"name": "Italy"
			  },
			  {
				"code": "CN",
				"name": "China"
			  },
			  {
				"code": "DE",
				"name": "Germany"
			  }
			],
			"network_provider": ["Airtel", "Jio", "Vodafone", "Wind Tre", "TIM", "FASTWEB", "Iliad", "Telekom", "O₂"],
			"network_type": ["WiFi", "5G", "4G", "3G", "2G", "Edge"],
			"locale": ["en_IN", "en_US", "en_UK", "it-IT", "en_HK", "zh_HK", "zh_Hans_HK", "ii_CN", "de_DE", "en_DE", "dsb_DE", "hsb_DE"],
			"device_manufacturer": ["Vivo", "Honor", "Oppo", "Huawei", "Xiaomi", "Lenovo", "Samsung"],
			"device_name": ["Samsung Galaxy Note 2", "Motorola Razor V2", "Huawei P30 Pro", "Vivo X900 Pro+", "Oppo Find X6 Pro", "Honor Magic5 Pro", "Xiaomi 13 Pro", "Lenovo Legion Y90", "Samsung Galaxy S23 Ultra"]
		  }`,
		"e2abe28a-f6bc-4f57-88fe-81f10d1c5afc": `{
			"version": ["2.2.1", "2.3.2", "3.1.4"],
			"country": [
			  {
				"code": "IT",
				"name": "Italy"
			  },
			  {
				"code": "CN",
				"name": "China"
			  },
			  {
				"code": "DE",
				"name": "Germany"
			  }
			],
			"network_provider": ["Vodafone", "Wind Tre", "TIM", "FASTWEB", "Iliad", "Telekom", "O₂"],
			"network_type": ["WiFi", "5G", "4G", "3G"],
			"locale": ["en_IN", "en_US", "it-IT", "en_HK", "zh_HK", "zh_Hans_HK", "ii_CN", "de_DE", "en_DE", "dsb_DE", "hsb_DE"],
			"device_manufacturer": ["Vivo", "Honor", "Oppo", "Xiaomi", "Lenovo", "Samsung"],
			"device_name": ["Samsung Galaxy Note 2", "Vivo X900 Pro+", "Oppo Find X6 Pro", "Honor Magic5 Pro", "Xiaomi 13 Pro", "Lenovo Legion Y90", "Samsung Galaxy S23 Ultra"]
		  }`,
		"b17f7003-4ab6-4b1a-a5d8-ed5a72cb4569": `{
			"version": ["2.2.1", "2.3.2", "3.1.1"],
			"country": [
			  {
				"code": "CN",
				"name": "China"
			  },
			  {
				"code": "DE",
				"name": "Germany"
			  }
			],
			"network_provider": ["Vodafone", "Wind Tre", "TIM", "FASTWEB", "Telekom", "O₂"],
			"network_type": ["WiFi", "4G", "3G", "2G", "Edge"],
			"locale": ["en_IN", "en_US", "en_UK", "it-IT", "en_HK", "zh_HK", "zh_Hans_HK", "ii_CN", "de_DE", "en_DE", "dsb_DE", "hsb_DE"],
			"device_manufacturer": ["Vivo", "Honor", "Oppo", "Huawei", "Lenovo", "Samsung"],
			"device_name": ["Samsung Galaxy Note 2", "Motorola Razor V2", "Huawei P30 Pro", "Vivo X900 Pro+", "Oppo Find X6 Pro", "Honor Magic5 Pro", "Lenovo Legion Y90", "Samsung Galaxy S23 Ultra"]
		  }`,
		"20014be8-aaa9-4e56-8810-9f1a48ec1099": `{
			"version": ["3.2.1", "3.3.2", "3.5.1", "3.5.2"],
			"country": [
			  {
				"code": "EE",
				"name": "Estonia"
			  },
			  {
				"code": "CH",
				"name": "Switzerland"
			  }
			],
			"network_provider": ["Telia", "Elisa", "Tele2", "Swisscom", "Sunrise", "Salt"],
			"network_type": ["WiFi", "5G", "4G", "3G", "2G", "Edge"],
			"locale": ["en_IN", "en_US", "en_CA", "it-CH", "rm_CH", "gsw_CH", "et_EE"],
			"device_manufacturer": ["Vivo", "Honor", "Oppo", "Huawei", "Lenovo", "Samsung", "Realme", "OnePlus", "Nokia"],
			"device_name": ["Huawei P30 Pro", "OnePlus 11 Pro", "Vivo X900 Pro+", "Noia X30", "Oppo Find X6 Pro", "Honor Magic5 Pro", "Lenovo Legion Y90", "Samsung Galaxy S23 Ultra"]
		  }`,
		"463c959c-94c2-4f49-bd2b-6caab360c152": `{
			"version": ["3.3.2", "3.5.1", "3.5.2", "3.5.3"],
			"country": [
			  {
				"code": "EE",
				"name": "Estonia"
			  },
			  {
				"code": "CH",
				"name": "Switzerland"
			  }
			],
			"network_provider": ["Telia", "Elisa", "Tele2", "Swisscom", "Sunrise", "Salt"],
			"network_type": ["5G", "4G", "3G", "2G"],
			"locale": ["en_CA", "it-CH", "rm_CH", "gsw_CH", "et_EE"],
			"device_manufacturer": ["Honor", "Oppo", "Huawei", "Lenovo", "Samsung", "Realme", "OnePlus", "Nokia"],
			"device_name": ["Huawei P30 Pro", "OnePlus 11 Pro", "Noia X30", "Oppo Find X6 Pro", "Honor Magic5 Pro", "Lenovo Legion Y90", "Samsung Galaxy S23 Ultra"]
		  }`,
		"2a7f230e-6d5e-4036-b4e6-1102c22f4433": `{
			"version": ["3.5.1", "3.5.2", "3.5.3", "3.6.0"],
			"country": [
			  {
				"code": "EE",
				"name": "Estonia"
			  },
			  {
				"code": "CH",
				"name": "Switzerland"
			  }
			],
			"network_provider": ["Telia", "Elisa", "Tele2", "Swisscom", "Sunrise", "Salt"],
			"network_type": ["WiFi", "5G", "4G", "2G", "Edge"],
			"locale": ["en_IN", "en_US", "en_CA", "it-CH", "rm_CH", "gsw_CH", "et_EE"],
			"device_manufacturer": ["Vivo", "Honor", "Oppo", "Huawei", "Realme", "OnePlus", "Nokia"],
			"device_name": ["Huawei P30 Pro", "OnePlus 11 Pro", "Vivo X900 Pro+", "Noia X30", "Oppo Find X6 Pro", "Honor Magic5 Pro"]
		  }`,
	}

	appFilters := appFiltersMap[appId.String()]

	if appFilters == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("no app filters exists for app [%s]", appId.String())})
	} else {
		c.Data(http.StatusOK, "application/json", []byte(appFilters))
	}

}

func CreateApp(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app := NewApp(teamId)
	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	apiKey, err := app.add()

	if err != nil {
		msg := "failed to create app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app.APIKey = apiKey

	c.JSON(http.StatusCreated, app)
}
