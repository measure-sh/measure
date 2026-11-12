package healthcheck

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func serverPort(t *testing.T, status int) (port string, closeFn func()) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
	}))
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return u.Port(), srv.Close
}

func TestPingOK(t *testing.T) {
	port, closeFn := serverPort(t, http.StatusOK)
	defer closeFn()
	if err := ping(port); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestPingNon200(t *testing.T) {
	port, closeFn := serverPort(t, http.StatusInternalServerError)
	defer closeFn()
	if err := ping(port); err == nil {
		t.Fatal("expected error for 500")
	}
}

func TestPingClosedPort(t *testing.T) {
	port, closeFn := serverPort(t, http.StatusOK)
	closeFn()
	if err := ping(port); err == nil {
		t.Fatal("expected error for closed port")
	}
}
