package inet

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/ipinfo/go/v2/ipinfo"
)

var client *ipinfo.Client

// Init initializes a new ipinfo.Client, caches the client
// and additionally returns it.
//
// IP lookup responses will be cached for 24 hours by default.
//
// Authorization uses the ipinfo token. If authorization fails,
// the default client will be used which will impact lookup performance.
//
// NOTE: For production, do not use the default client.
func Init() *ipinfo.Client {
	token := os.Getenv("IPINFO_TOKEN")
	if token == "" {
		log.Printf("%q env var not set, falling back to default client. ip lookup performance will have a negative impact.\n", "IPINFO_TOKEN")
		client = ipinfo.DefaultClient
		return client
	}

	cache := ipinfo.NewCache(ipinfo.Cache{})
	client = ipinfo.NewClient(nil, cache, token)
	return client
}

// Lookup returns all possible info for an IP
func Lookup(ip string) (*ipinfo.Core, error) {
	if client == nil {
		return nil, fmt.Errorf("lookup called before inet init")
	}

	info, err := client.GetIPInfo(net.ParseIP(ip))
	if err != nil {
		return nil, err
	}

	return info, nil
}

// LookupCountry looks up the country code of the ip in
// a best-case scenario.
//
// Returns "bogon" for bogon addresses. Supports both
// IPv4 and IPv6.
func LookupCountry(ip string) (*string, error) {
	country, err := client.GetIPCountry(net.ParseIP(ip))
	if err != nil {
		msg := fmt.Sprintf("failed to lookup country for ip: [%s]", ip)
		fmt.Println(msg, err)
		return nil, err
	}

	return &country, err
}

// Isv4 checks if a given IP is version 4
// or 6.
func Isv4(ip net.IP) bool {
	if ip.To4() != nil {
		return true
	} else {
		return false
	}
}
