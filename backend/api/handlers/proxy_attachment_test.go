//go:build integration

package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestProxyAttachmentHardening(t *testing.T) {
	const csp = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

	tests := []struct {
		name            string
		method          string
		status          int
		contentType     string
		upstreamDisp    string
		wantDisposition string
		wantHardened    bool
	}{
		{"GET 200 html", http.MethodGet, http.StatusOK, "text/html; charset=utf-8", "", "attachment", true},
		{"GET 206 png", http.MethodGet, http.StatusPartialContent, "image/png", "", "inline", true},
		{"GET 403 xml", http.MethodGet, http.StatusForbidden, "application/xml", "", "attachment", true},
		{"HEAD 200 png", http.MethodHead, http.StatusOK, "image/png", "", "inline", true},
		{"PUT untouched", http.MethodPut, http.StatusOK, "text/html", "inline", "inline", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", tt.contentType)
				if tt.upstreamDisp != "" {
					w.Header().Set("Content-Disposition", tt.upstreamDisp)
				}
				w.WriteHeader(tt.status)
				w.Write([]byte("<script>alert(1)</script>"))
			}))
			t.Cleanup(store.Close)

			origEndpoint := deps.Config.AWSEndpoint
			deps.Config.AWSEndpoint = store.URL
			t.Cleanup(func() { deps.Config.AWSEndpoint = origEndpoint })

			payload := url.QueryEscape(store.URL + "/bucket/key?sig=abc")
			c, w := newProxyTestContext(tt.method, "/proxy/attachments?payload="+payload)
			h.ProxyAttachment(c)

			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
			if got := w.Header().Get("Content-Disposition"); got != tt.wantDisposition {
				t.Errorf("Content-Disposition = %q, want %q", got, tt.wantDisposition)
			}

			gotCSP := w.Header().Get("Content-Security-Policy")
			gotSniff := w.Header().Get("X-Content-Type-Options")
			if !tt.wantHardened {
				if gotCSP != "" || gotSniff != "" {
					t.Errorf("headers hardened on %s: csp=%q nosniff=%q", tt.method, gotCSP, gotSniff)
				}
				return
			}
			if gotCSP != csp {
				t.Errorf("Content-Security-Policy = %q, want %q", gotCSP, csp)
			}
			if gotSniff != "nosniff" {
				t.Errorf("X-Content-Type-Options = %q, want nosniff", gotSniff)
			}
		})
	}
}
