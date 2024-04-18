package measure

import (
	"context"
	"encoding/json"
	"fmt"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/inet"
	"measure-backend/measure-go/server"
	"measure-backend/measure-go/symbol"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ipinfo/go/v2/ipinfo"
)

// maxBatchSize is the maximum allowed payload
// size of event request in bytes.
var maxBatchSize = 20 * 1024 * 1024

type attachment struct {
	id       uuid.UUID
	name     string
	location string
	header   *multipart.FileHeader
	uploaded bool
}

type eventreq struct {
	symbolicate map[uuid.UUID]int
	size        int64
	events      []event.EventField
	attachments []attachment
}

// hasAttachments returns true if payload
// contains attachments to be processed.
func (e eventreq) hasAttachments() bool {
	return len(e.attachments) > 0
}

// needsSymbolication returns true if payload
// contains events that should be symbolicated.
func (e eventreq) needsSymbolication() bool {
	return len(e.symbolicate) > 0
}

// validate validates the integrity of each event
// and corresponding attachments.
func (e eventreq) validate() error {
	for i := range e.events {
		if err := e.events[i].Validate(); err != nil {
			return err
		}
		if err := e.events[i].Attributes.Validate(); err != nil {
			return err
		}

		if e.hasAttachments() {
			for j := range e.events[i].Attachments {
				if err := e.events[i].Attachments[j].Validate(); err != nil {
					return err
				}
			}
		}
	}

	if e.size >= int64(maxBatchSize) {
		return fmt.Errorf(`payload cannot exceed maximum allowed size of %d`, maxBatchSize)
	}

	return nil
}

// uploadAttachments prepares and uploads each attachment.
func (e *eventreq) uploadAttachments() error {
	for i := range e.attachments {
		attachment := event.Attachment{
			ID:   e.attachments[i].id,
			Name: e.attachments[i].header.Filename,
			Key:  e.attachments[i].id.String(),
		}

		file, err := e.attachments[i].header.Open()
		if err != nil {
			return err
		}

		attachment.Reader = file

		output, err := attachment.Upload()
		if err != nil {
			return err
		}

		e.attachments[i].uploaded = true
		e.attachments[i].location = output.Location
	}

	return nil
}

// bumpSize increases the payload size of
// events in bytes.
func (e *eventreq) bumpSize(n int64) {
	e.size = e.size + n
}

// read parses and validates the event request payload for
// event and attachments.
func (e *eventreq) read(c *gin.Context, appId uuid.UUID) error {
	form, err := c.MultipartForm()
	if err != nil {
		return err
	}

	events := form.Value["event"]
	if len(events) < 1 {
		return fmt.Errorf(`payload must contain at least 1 event`)
	}

	for i := range events {
		if events[i] == "" {
			return fmt.Errorf(`any event field must not be empty`)
		}
		var event event.EventField
		bytes := []byte(events[i])
		if err := json.Unmarshal(bytes, &event); err != nil {
			return err
		}
		e.bumpSize(int64(len(bytes)))
		event.AppID = appId
		if event.NeedsSymbolication() {
			e.symbolicate[event.ID] = i
		}
		e.events = append(e.events, event)
	}

	for key, headers := range form.File {
		id, ok := strings.CutPrefix(key, "blob-")
		if !ok {
			continue
		}
		blobId, err := uuid.Parse(id)
		if err != nil {
			return err
		}
		if len(headers) < 1 {
			return fmt.Errorf(`blob attachments must not be empty`)
		}
		header := headers[0]
		if header == nil {
			continue
		}
		e.bumpSize(header.Size)
		e.attachments = append(e.attachments, attachment{
			id:     blobId,
			name:   header.Filename,
			header: header,
		})
	}

	return nil
}

// infuseInet looks up the country code for the IP
// and infuses the country code and IP info to each event.
func (e *eventreq) infuseInet(rawIP string) error {
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

	for i := range e.events {
		if v4 {
			e.events[i].IPv4 = ip
		} else {
			e.events[i].IPv6 = ip
		}

		if bogon {
			e.events[i].CountryCode = "bogon"
		} else if *country != "" {
			e.events[i].CountryCode = *country
		} else {
			e.events[i].CountryCode = "not available"
		}
	}

	return nil
}

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
		msg := fmt.Sprintf(`could not process request, failed to lookup country info for IP %q`, c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	for _, event := range p.Events {
		fmt.Printf("%+v\n", event)
	}

	c.JSON(http.StatusNotImplemented, gin.H{"ok": "ok"})
}

func PutEventMulti(c *gin.Context) {
	appId, err := uuid.Parse(c.GetString("appId"))
	if err != nil {
		msg := `error parsing app's uuid`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	msg := `failed to parse events payload`
	eventReq := eventreq{
		symbolicate: make(map[uuid.UUID]int),
	}

	if err := eventReq.read(c, appId); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := eventReq.validate(); err != nil {
		msg := `failed to validate events payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := eventReq.infuseInet(c.ClientIP()); err != nil {
		msg := fmt.Sprintf(`failed to lookup country info for IP: %q`, c.ClientIP())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if eventReq.needsSymbolication() {
		// symbolicate
		symbolicator, err := symbol.NewSymbolicator(&symbol.Options{
			Origin: os.Getenv("SYMBOLICATOR_ORIGIN"),
			Store:  server.Server.PgPool,
		})
		if err != nil {
			msg := `failed to initialize symbolicator`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}

		batches := symbolicator.Batch(eventReq.events)
		fmt.Println("batches", batches)
		ctx := context.Background()

		for i := range batches {
			if err := symbolicator.Symbolicate(ctx, batches[i]); err != nil {
				msg := `failed to symbolicate batch`
				fmt.Println(msg, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   msg,
					"details": err.Error(),
				})
				return
			}
			fmt.Println("symbolicated batch events", batches[i].Events)

			// handle symbolication errors
			if len(batches[i].Errs) > 0 {
				for _, err := range batches[i].Errs {
					fmt.Println("symbolication err: ", err.Error())
				}
			}

			// rewrite symbolicated events
			for j := range batches[i].Events {
				eventId := batches[i].Events[j].ID
				idx, exists := eventReq.symbolicate[eventId]
				if !exists {
					continue
				}
				eventReq.events[idx] = batches[i].Events[j]
				delete(eventReq.symbolicate, eventId)
			}
		}
	}

	if eventReq.hasAttachments() {
		if err := eventReq.uploadAttachments(); err != nil {
			msg := `failed to ingest attachments`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	fmt.Println("events", eventReq.events)
	fmt.Println("event req", eventReq.attachments)
	fmt.Println("size", eventReq.size)
	fmt.Println("has attachments", eventReq.hasAttachments())
	fmt.Println("needs symbolication", eventReq.needsSymbolication())
	c.JSON(http.StatusAccepted, gin.H{"events": eventReq.events})
}
