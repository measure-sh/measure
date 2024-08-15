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

// Init initializes the mmdb database.
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
