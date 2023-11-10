package main

import (
	"math/rand"
	"net/http"

	"github.com/gin-gonic/gin"
)

func getAppJourney(c *gin.Context) {
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

func getAppMetrics(c *gin.Context) {
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
