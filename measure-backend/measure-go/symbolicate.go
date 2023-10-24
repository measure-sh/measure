package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/google/uuid"
)

type SymbolicationUnit struct {
	ID     uuid.UUID `json:"id"`
	Values []string  `json:"values"`
}

type SymbolicationRequest struct {
	Key                string              `json:"key"`
	SymbolicationUnits []SymbolicationUnit `json:"data"`
}

func symbolicate(s *Session) error {
	key, err := s.getMappingKey()
	if err != nil {
		return err
	}
	if key == "" {
		return nil
	}

	codecMap, symbolicationUnits := s.EncodeForSymbolication()

	payload := &SymbolicationRequest{
		Key:                key,
		SymbolicationUnits: symbolicationUnits,
	}

	symbolicateUrl, err := url.JoinPath(os.Getenv("SYMBOLICATOR_ORIGIN"), "symbolicate")
	if err != nil {
		fmt.Println("could not form URL for symbolicator", err.Error())
		return err
	}
	data, err := json.Marshal(payload)
	if err != nil {
		fmt.Println("failed to create symbolication request", err.Error())
		return err
	}

	req, err := http.NewRequest("POST", symbolicateUrl, bytes.NewBuffer(data))
	if err != nil {
		fmt.Println(err)
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println(err)
		return err
	}
	defer resp.Body.Close()
	fmt.Println("symbolicator response status", resp.Status)

	var symbolResult []SymbolicationUnit
	if err = json.NewDecoder(resp.Body).Decode(&symbolResult); err != nil {
		fmt.Println("failed to read symbolicator response", err)
		return err
	}
	s.DecodeFromSymbolication(codecMap, symbolResult)

	return nil
}
