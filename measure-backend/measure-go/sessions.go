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
	err := s.Resource.validate()

	for _, event := range s.Events {
		err := event.validate()
		if err != nil {
			return err
		}
	}

	if err != nil {
		return err
	}

	return nil
}

func putSession(c *gin.Context) {
	session := new(Session)
	if err := c.ShouldBindJSON(&session); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := session.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query, args := makeInsertQuery("events_test_2", columns, session)
	if err := server.chPool.AsyncInsert(context.Background(), query, false, args...); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_, err := server.pgPool.Exec(context.Background(), `insert into sessions (id, timestamp, event_count) values ($1, $2, $3);`, uuid.New(), time.Now(), len(session.Events))

	if err != nil {
		fmt.Println(`failed to write session to db`, err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"error": `failed to record the session`})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"ok": "accepted"})
}
