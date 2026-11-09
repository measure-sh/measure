package inet

import (
	"net"
	"testing"
)

func TestIsBogon(t *testing.T) {
	_ = Init()

	ipOne := net.ParseIP("127.0.0.1")
	ipTwo := net.ParseIP("192.168.1.10")
	ipThree := net.ParseIP("::1")
	ipFour := net.ParseIP("8.8.8.8")
	ipFive := net.ParseIP("2001:4860:4860::8888")

	if IsBogon(ipOne) != true {
		t.Errorf("Expected %q to be bogon, but got false", ipOne)
	}

	if IsBogon(ipTwo) != true {
		t.Errorf("Expected %q to be bogon, but got false", ipTwo)
	}

	if IsBogon(ipThree) != true {
		t.Errorf("Expected %q to be bogon, but got false", ipThree)
	}

	if IsBogon(ipFour) == true {
		t.Errorf("Expected %q to be not bogon, but got true", ipFour)
	}

	if IsBogon(ipFive) == true {
		t.Errorf("Expected %q to be not bogon, but got true", ipFive)
	}
}

// TestCountryCode checks ISO country code lookup for IPv4 & IPv6.
func TestCountryCode(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		ip   string
		want string
	}{
		{"8.8.8.8", "US"},
		{"2001:4860:4860::8888", "US"},
	}

	for _, tt := range tests {
		got, err := CountryCode(net.ParseIP(tt.ip))
		if err != nil {
			t.Fatal(err)
		}
		if got != tt.want {
			t.Errorf("CountryCode(%s) = %q, want %q", tt.ip, got, tt.want)
		}
	}
}
