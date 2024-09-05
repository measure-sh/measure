package inet

import (
	"embed"
	"net"

	"github.com/oschwald/maxminddb-golang"
)

//go:embed country.mmdb
var mmdbFile embed.FS

// geodb is the mmdb reader instance
var geodb *maxminddb.Reader

// ipv4Nets defines a list of
// bogon ipv4 ranges.
var ipv4Nets []*net.IPNet

// ipv6Nets defines a list of
// bogon ipv6 ranges.
var ipv6Nets []*net.IPNet

// Init initializes the inet geoip system.
func Init() (err error) {
	dbFile, err := mmdbFile.ReadFile("country.mmdb")
	if err != nil {
		return
	}
	db, err := maxminddb.FromBytes(dbFile)
	if err != nil {
		return
	}
	geodb = db

	// See more: https://en.wikipedia.org/wiki/Reserved_IP_addresses
	ipv4Bogons := []string{
		"10.0.0.0/8",     // private
		"172.16.0.0/12",  // private
		"192.168.0.0/16", // private
		"169.254.0.0/16", // subnet, link-local addresses
		"127.0.0.0/8",    // loopback
		"224.0.0.0/4",    // multicast (former Class D)
		"240.0.0.0/4",    // reserved (former Class E)
	}

	ipv6Bogons := []string{
		"::1/128",   // loopback
		"fe80::/10", // link-local addresses
		"ff00::/8",  // multicast
		"fc00::/7",  // private internets, unique local address
	}

	// cache ipv4 bogon nets
	for _, cidr := range ipv4Bogons {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			return err
		}

		ipv4Nets = append(ipv4Nets, network)
	}

	// cache ipv6 bogon nets
	for _, cidr := range ipv6Bogons {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			return err
		}

		ipv6Nets = append(ipv6Nets, network)
	}

	return
}

// Initialized checks if the mmdb database
// instance has been initialized.
func Initialized() bool {
	return geodb != nil
}

// Close closes the mmdb instance.
func Close() (err error) {
	if Initialized() {
		return geodb.Close()
	}

	return
}

// IsBogon returns true if the IP
// is not routable via public
// internet.
func IsBogon(ip net.IP) bool {
	if ip.To4() != nil {
		for _, network := range ipv4Nets {
			if network.Contains(ip) {
				return true
			}
		}
	} else if ip.To16() != nil {
		for _, network := range ipv6Nets {
			if network.Contains(ip) {
				return true
			}
		}
	}

	return false
}

// CountryCode looks up the country code for
// an IP.
func CountryCode(ip net.IP) (countryCode string, err error) {
	var record map[string]string

	if err = geodb.Lookup(ip, &record); err != nil {
		return
	}

	countryCode = record["country"]

	return
}

// Isv4 checks if a given IP is version 4
// or 6.
func Isv4(ip net.IP) bool {
	return ip.To4() != nil
}
