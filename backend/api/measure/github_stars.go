package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"backend/api/server"
	"backend/libs/concur"

	"github.com/gin-gonic/gin"
)

const githubStarsRepo = "measure-sh/measure"

type githubRepoResponse struct {
	StargazersCount int `json:"stargazers_count"`
}

func fetchGitHubStarCount(ctx context.Context, token string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/repos/"+githubStarsRepo, nil)
	if err != nil {
		return 0, err
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var data githubRepoResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, err
	}

	return data.StargazersCount, nil
}

func storeGitHubStarCount(ctx context.Context, repo string, date time.Time, count int) error {
	_, err := server.Server.PgPool.Exec(ctx,
		`INSERT INTO measure.github_star_history (repo, starred_at, star_count)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (repo, starred_at) DO UPDATE SET star_count = EXCLUDED.star_count`,
		repo, date.UTC().Format("2006-01-02"), count,
	)
	return err
}

// ScheduleGitHubStarsCollection starts a background goroutine that fetches
// and stores the daily star count for the measure-sh/measure repo.
// It collects once on startup, then again every 24 hours.
// The goroutine exits when ctx is cancelled (server shutdown).
func ScheduleGitHubStarsCollection(ctx context.Context, token string) {
	concur.GlobalWg.Add(1)
	go func() {
		defer concur.GlobalWg.Done()

		collect := func() {
			collectCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()

			count, err := fetchGitHubStarCount(collectCtx, token)
			if err != nil {
				fmt.Printf("github stars: failed to fetch star count: %v\n", err)
				return
			}

			if err := storeGitHubStarCount(collectCtx, githubStarsRepo, time.Now(), count); err != nil {
				fmt.Printf("github stars: failed to store star count: %v\n", err)
				return
			}

			fmt.Printf("github stars: stored %d stars for %s\n", count, githubStarsRepo)
		}

		collect()

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				collect()
			}
		}
	}()
}

// GetGitHubStarsDailyPlot returns daily star count history for the
// measure-sh/measure repository, formatted for a Nivo line chart.
func GetGitHubStarsDailyPlot(c *gin.Context) {
	ctx := c.Request.Context()

	rows, err := server.Server.PgPool.Query(ctx,
		`SELECT starred_at, star_count
		 FROM measure.github_star_history
		 WHERE repo = $1
		 ORDER BY starred_at ASC`,
		githubStarsRepo,
	)
	if err != nil {
		msg := "failed to query GitHub star history"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	defer rows.Close()

	type dataPoint struct {
		DateTime string `json:"datetime"`
		Stars    int    `json:"stars"`
	}

	var points []dataPoint
	for rows.Next() {
		var date time.Time
		var count int
		if err := rows.Scan(&date, &count); err != nil {
			msg := "failed to scan GitHub star history row"
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
			return
		}
		points = append(points, dataPoint{
			DateTime: date.UTC().Format("2006-01-02"),
			Stars:    count,
		})
	}

	if rows.Err() != nil {
		msg := "error iterating GitHub star history rows"
		fmt.Println(msg, rows.Err())
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(points) == 0 {
		c.JSON(http.StatusOK, nil)
		return
	}

	type series struct {
		ID   string      `json:"id"`
		Data []dataPoint `json:"data"`
	}

	c.JSON(http.StatusOK, []series{{
		ID:   githubStarsRepo,
		Data: points,
	}})
}
