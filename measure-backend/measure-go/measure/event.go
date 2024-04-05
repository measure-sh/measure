package measure

import (
	"fmt"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/inet"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/ipinfo/go/v2/ipinfo"
)

// lookupCountry looks up the country code for the IP
// and infuses the country code and IP info to each event.
func lookCountry(events []event.EventField, rawIP string) error {
	ip := net.ParseIP(rawIP)
	country, err := inet.LookupCountry(rawIP)
	if err != nil {
		return err
	}

	bogon, err := ipinfo.GetIPBogon(ip)
	if err != nil {
		return err
	}

	v4 := inet.Isv4(ip)

	for i := range events {
		if v4 {
			events[i].IPv4 = ip
		} else {
			events[i].IPv6 = ip
		}

		if bogon {
			events[i].CountryCode = "bogon"
		} else if *country != "" {
			events[i].CountryCode = *country
		} else {
			events[i].CountryCode = "not available"
		}
	}

	return nil
}

func PutEvent(c *gin.Context) {
	type payload struct {
		Events []event.EventField `json:"events" binding:"required"`
	}

	var p payload
	if err := c.ShouldBindJSON(&p); err != nil {
		msg := `failed to decode events payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := lookCountry(p.Events, c.ClientIP()); err != nil {
		msg := fmt.Sprintf(`could not process request, failed to lookup country infor for IP %q`, c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	for _, event := range p.Events {
		fmt.Printf("%+v\n", event)
	}

	c.JSON(http.StatusNotImplemented, gin.H{"ok": "ok"})
}
