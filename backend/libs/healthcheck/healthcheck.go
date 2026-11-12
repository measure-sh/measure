// Package healthcheck probes /ping for shell-less images via `<bin> healthcheck`.
package healthcheck

import (
	"cmp"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Run probes this process's /ping & exits when invoked as `<bin> healthcheck`; otherwise it returns.
func Run(defaultPort string) {
	if len(os.Args) < 2 || os.Args[1] != "healthcheck" {
		return
	}
	if err := ping(cmp.Or(os.Getenv("PORT"), defaultPort)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}

// ping GETs /ping on loopback & fails on any non-200 status.
func ping(port string) error {
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/ping")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck: unexpected status %d", resp.StatusCode)
	}
	return nil
}
