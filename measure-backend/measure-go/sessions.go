package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Session struct {
	SessionID uuid.UUID    `json:"session_id" binding:"required"`
	Timestamp time.Time    `json:"timestamp" binding:"required"`
	Resource  Resource     `json:"resource" binding:"required"`
	Events    []EventField `json:"events" binding:"required"`
}

func (s *Session) validate() error {
	if err := s.Resource.validate(); err != nil {
		return err
	}

	for _, event := range s.Events {
		err := event.validate()
		if err != nil {
			return err
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

func putSession(c *gin.Context) {
	session := new(Session)
	if err := c.ShouldBindJSON(&session); err != nil {
		fmt.Println(err)
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
		if _, err := symbolicate(session); err != nil {
			fmt.Println("symbolication failed with error", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not upload session, failed to symbolicate"})
			return
		}
	}

	query, args := makeInsertQuery("events_test_2", columns, session)
	if err := server.chPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, err := server.pgPool.Exec(context.Background(), `insert into sessions (id, event_count, timestamp) values ($1, $2, $3);`, session.SessionID, len(session.Events), time.Now())

	if err != nil {
		fmt.Println(`failed to write session to db`, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": `failed to record the session`})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
