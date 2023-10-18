package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Session struct {
	SessionID   uuid.UUID    `json:"session_id" binding:"required"`
	Timestamp   time.Time    `json:"timestamp" binding:"required"`
	Resource    Resource     `json:"resource" binding:"required"`
	Events      []EventField `json:"events" binding:"required"`
	Attachments []Attachment `json:"attachments"`
}

type ByteCounter struct {
	Count int64
}

func (bc *ByteCounter) Write(p []byte) (int, error) {
	n := len(p)
	bc.Count += int64(n)
	return n, nil
}

func (s *Session) validate() error {
	if err := s.Resource.validate(); err != nil {
		return err
	}

	for _, event := range s.Events {
		if err := event.validate(); err != nil {
			return err
		}

	}

	if s.hasAttachments() {
		for _, attachment := range s.Attachments {
			if err := attachment.validate(); err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *Session) hasExceptions() bool {
	for _, event := range s.Events {
		if event.isException() {
			return true
		}
	}
	return false
}

func (s *Session) hasANRs() bool {
	for _, event := range s.Events {
		if event.isANR() {
			return true
		}
	}
	return false
}

func (s *Session) hasAppExits() bool {
	for _, event := range s.Events {
		if event.isAppExit() {
			return true
		}
	}
	return false
}

func (s *Session) hasAttachments() bool {
	return len(s.Attachments) > 0
}

func (s *Session) needsSymbolication() bool {
	if s.hasExceptions() || s.hasANRs() || s.hasAppExits() {
		return true
	}
	return false
}

func (s *Session) getObfuscatedEvents() []EventField {
	var obfuscatedEvents []EventField
	for _, event := range s.Events {
		if event.symbolicatable() {
			obfuscatedEvents = append(obfuscatedEvents, event)
		}
	}
	return obfuscatedEvents
}

func (s *Session) uploadAttachments() error {
	for _, attachment := range s.Attachments {
		uploadOutput, err := attachment.upload()
		if err != nil {
			return err
		}
		fmt.Printf("upload output of %s, location is %s\n", attachment.Name, uploadOutput.Location)
	}

	return nil
}

func (s *Session) saveWithContext(c *gin.Context) error {
	bytesIn := c.MustGet("bytesIn")
	_, err := server.pgPool.Exec(context.Background(), `insert into sessions (id, event_count, attachment_count, bytes_in, timestamp) values ($1, $2, $3, $4, $5);`, s.SessionID, len(s.Events), len(s.Attachments), bytesIn, time.Now())

	if err != nil {
		fmt.Println(`failed to write session to db`, err.Error())
		return err
	}
	return nil
}

func countSessionSize() gin.HandlerFunc {
	return func(c *gin.Context) {
		bc := &ByteCounter{}
		c.Request.Body = io.NopCloser(io.TeeReader(c.Request.Body, bc))

		c.Next()

		c.Set("bytesIn", bc.Count)
		session := c.MustGet("session").(*Session)
		session.saveWithContext(c)
	}
}

func putSession(c *gin.Context) {
	session := new(Session)
	if err := c.ShouldBindJSON(&session); err != nil {
		fmt.Println("gin binding err:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse session payload"})
		return
	}

	var existing string
	if err := server.pgPool.QueryRow(context.Background(), `select id from sessions where id = $1 limit 1;`, session.SessionID).Scan(&existing); err != nil {
		if err.Error() != "no rows in result set" {
			fmt.Println(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if existing == session.SessionID.String() {
		c.JSON(http.StatusAccepted, gin.H{"ok": "accepted, known session"})
		return
	}

	if err := session.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if session.needsSymbolication() {
		if err := symbolicate(session); err != nil {
			fmt.Println("symbolication failed with error", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not upload session, failed to symbolicate"})
			return
		}
	}

	if session.hasAttachments() {
		if err := session.uploadAttachments(); err != nil {
			fmt.Println("error uploading attachment", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload attachment(s)"})
			return
		}
	}

	query, args := makeInsertQuery("events_test_2", columns, session)
	if err := server.chPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println("clickhouse insert err:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Set("session", session)
	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
