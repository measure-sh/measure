package symbolicator

import (
	"backend/api/chrono"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"time"
)

// maxRetryCount defines the maximum
// number of times a failed symbolicator
// request will be retried.
const maxRetryCount = 5

// defaultRetryDuration is the default duration
// between each retry of symbolicator requests.
var defaultRetryDuration = time.Second * 10

var ErrRequestFailed = errors.New("symbolicator received non-200 status")
var ErrRetryExhausted = errors.New("symbolicator retry exhaustion")

// SymbolicatorRequest maintains the state
// of a single symbolicator request.
type SymbolicatorRequest struct {
	req        *http.Request
	retryCount int
}

// httpClient is a custom http client
// with modified timeout values to
// support higher throughput.
var httpClient = &http.Client{
	Timeout:   30 * time.Second,
	Transport: &http.Transport{
		// MaxIdleConns:        100,
		// MaxIdleConnsPerHost: 20,
	},
}

// makeRequest sends the symbolicator request
// and retries if necessary.
func (sr *SymbolicatorRequest) makeRequest() ([]byte, error) {
	var respBody []byte
	var err error

	res, err := httpClient.Do(sr.req)
	if err != nil {
		fmt.Println("failed sending symbolicator request:", err)
		return nil, fmt.Errorf("failed to send request: %w", err)
	}

	if logResponse {
		fmt.Println("symbolicator response status code:", res.StatusCode)
	}

	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusServiceUnavailable,
		http.StatusBadGateway,
		http.StatusTooManyRequests:
		// retry after few seconds
		return sr.retry(defaultRetryDuration)
	}

	if res.StatusCode != http.StatusOK {
		err = ErrRequestFailed
		// try parsing the error response
		// body, ignoring any parsing errors
		errBody, errParse := io.ReadAll(res.Body)
		if errParse == nil {
			fmt.Println("symbolicator error response body:", string(errBody))
		}
		return nil, fmt.Errorf("%w: status code %d", err, res.StatusCode)
	}

	respBody, err = io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if len(respBody) == 0 {
		return nil, errors.New("empty response body received")
	}

	return respBody, nil
}

// retry retries a failed symbolicator request
// with a randomly added duration jitter to avoid
// thundering-herd like problems.
func (sr *SymbolicatorRequest) retry(d time.Duration) ([]byte, error) {
	if sr.retryCount >= maxRetryCount {
		return nil, ErrRetryExhausted
	}

	dur := defaultRetryDuration
	if d.Seconds() > 0 {
		dur = d
	}

	sr.retryCount += 1
	fmt.Printf("retrying symbolicator request for %d time(s) in about %v\n", sr.retryCount, dur)
	chrono.JitterySleep(dur)

	return sr.makeRequest()
}

// prepareAppleCrashReportRequest prepares the
// apple crash report request payload.
func (sr *SymbolicatorRequest) prepareAppleRequest(as *appleSymbolicator, origin string, sources []Source) (err error) {
	var reqBody bytes.Buffer
	var sourcesBytes []byte
	if len(sources) > 0 {
		sourcesBytes, err = json.Marshal(sources)
		if err != nil {
			return
		}
	}

	url := origin
	writer := multipart.NewWriter(&reqBody)
	crashReport := as.appleCrashReport
	url += "/applecrashreport"

	// if there are sources, add the "sources"
	// form field
	if len(sources) > 0 {
		jsonHeader := make(textproto.MIMEHeader)
		jsonHeader.Set("Content-Disposition", `form-data; name="sources"`)
		jsonHeader.Set("Content-Type", "application/json")

		jsonPart, errSources := writer.CreatePart(jsonHeader)
		if errSources != nil {
			return errSources
		}

		_, err = jsonPart.Write(sourcesBytes)
		if err != nil {
			return
		}
	}

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="apple_crash_report"; filename="crash-report.txt"`)
	header.Set("Content-Type", "text/plain")

	fileWriter, errReport := writer.CreatePart(header)
	if errReport != nil {
		return errReport
	}

	if _, err = io.Copy(fileWriter, bytes.NewBuffer(crashReport)); err != nil {
		return
	}

	if err = writer.Close(); err != nil {
		return
	}

	sr.req, err = http.NewRequest("POST", url, &reqBody)
	if err != nil {
		return
	}

	sr.req.Header.Set("Content-Type", writer.FormDataContentType())

	if logRequest {
		fmt.Printf("apple crash report request\n%s\n", string(as.appleCrashReport))
	}

	return
}

// prepareJvmRequest prepares the jvm request
// for symbolicator.
func (sr *SymbolicatorRequest) prepareJvmRequest(js *jvmSymbolicator, origin string, sources []Source) (err error) {
	var reqBody bytes.Buffer
	url := origin

	url += "/symbolicate-jvm"
	js.request.Sources = sources

	reqBytes, errJSON := json.Marshal(js.request)
	if errJSON != nil {
		return errJSON
	}
	if _, err = reqBody.Write(reqBytes); err != nil {
		return
	}

	if logRequest {
		var dst bytes.Buffer
		if err = json.Indent(&dst, reqBytes, "", "  "); err != nil {
			return
		}
		fmt.Printf("jvm symbolicator request\n%s\n", dst.String())
	}

	sr.req, err = http.NewRequest("POST", url, &reqBody)
	if err != nil {
		return
	}
	sr.req.Header.Set("Content-Type", "application/json")

	return
}

// prepareNativeRequest prepares the native request
// for symbolicator.
func (sr *SymbolicatorRequest) prepareNativeRequest(ns *nativeSymbolicator, origin string, sources []Source) (err error) {
	var reqBody bytes.Buffer
	url := origin

	url += "/symbolicate"
	ns.request.Sources = sources

	reqBytes, errJSON := json.Marshal(ns.request)
	if errJSON != nil {
		return errJSON
	}
	if _, err = reqBody.Write(reqBytes); err != nil {
		return
	}

	if logRequest {
		var dst bytes.Buffer
		if err = json.Indent(&dst, reqBytes, "", "  "); err != nil {
			return
		}
		fmt.Printf("native symbolicator request\n%s\n", dst.String())
	}

	sr.req, err = http.NewRequest("POST", url, &reqBody)
	if err != nil {
		return
	}
	sr.req.Header.Set("Content-Type", "application/json")

	return
}
