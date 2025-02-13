package symbolicator

import (
	"backend/api/event"
	"backend/api/platform"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
)

type Symbolicator struct {
	Origin           string
	Platform         string
	Sources          []Source
	appleCrashReport []byte
	req              *http.Request
	res              *http.Response
}

func New(origin, platform string, sources []Source) (symbolicator *Symbolicator) {
	symbolicator = &Symbolicator{
		Origin:   origin,
		Platform: platform,
	}

	if len(sources) > 0 {
		symbolicator.Sources = sources
	}

	return
}

func (s *Symbolicator) Symbolicate(events []event.EventField) (err error) {
	switch s.Platform {
	case platform.Android:
	case platform.IOS:
		s.appleCrashReport = makeAppleCrashReport(events)
	}

	if err = s.makeRequest(); err != nil {
		return
	}
	return
}

func (s *Symbolicator) makeRequest() (err error) {
	var reqBody bytes.Buffer
	var sources []byte
	if len(s.Sources) > 0 {
		sources, err = json.Marshal(s.Sources)
		if err != nil {
			return
		}

		fmt.Println("sources:", string(sources))
	}

	url := s.Origin

	fmt.Println("symbolicator platform", s.Platform)

	switch s.Platform {
	case platform.Android:
	case platform.IOS:
		fmt.Println("coming inside ios case")
		writer := multipart.NewWriter(&reqBody)
		crashReport := s.appleCrashReport
		url += "/applecrashreport"

		jsonHeader := make(textproto.MIMEHeader)
		jsonHeader.Set("Content-Disposition", `form-data; name="sources"`)
		jsonHeader.Set("Content-Type", "application/json")

		jsonPart, errSources := writer.CreatePart(jsonHeader)
		if errSources != nil {
			return errSources
		}

		_, err = jsonPart.Write(sources)
		if err != nil {
			return
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

		// fileWriter, errFormFile := writer.CreateFormFile("apple_crash_report", "crash_report.txt")
		// if errFormFile != nil {
		// 	return errFormFile
		// }

		// _, err = io.Copy(fileWriter, bytes.NewBuffer([]byte(crashReport)))
		// if err != nil {
		// 	return
		// }

		// if err = writer.WriteField("sources", string(sources)); err != nil {
		// 	return
		// }

		if err = writer.Close(); err != nil {
			return
		}

		s.req, err = http.NewRequest("POST", url, &reqBody)
		if err != nil {
			return
		}

		s.req.Header.Set("Content-Type", writer.FormDataContentType())
	}

	s.res, err = http.DefaultClient.Do(s.req)
	if err != nil {
		return
	}

	defer s.res.Body.Close()

	respBody, err := io.ReadAll(s.res.Body)
	if err != nil {
		return
	}

	var prettyJSON bytes.Buffer

	if err = json.Indent(&prettyJSON, respBody, "", "  "); err != nil {
		return
	}

	fmt.Println("response", prettyJSON.String())

	return
}

func makeAppleCrashReport(events []event.EventField) (report []byte) {
	const sep = "    "
	var b strings.Builder
	for _, event := range events {
		if event.Attribute.Platform != platform.IOS {
			continue
		}
		if !event.IsException() {
			continue
		}

		for j, exception := range event.Exception.Exceptions {
			// write os info
			b.WriteString(fmt.Sprintf("Version: %s (%s)\n", event.Attribute.AppVersion, event.Attribute.AppBuild))

			// write cpu arch
			b.WriteString(fmt.Sprintf("Code Type: %s\n", event.Attribute.DeviceCPUArch))

			// write os version
			b.WriteString(fmt.Sprintf("OS Version: iPhone OS %s (%s)\n", event.Attribute.OSVersion, exception.OSBuildNumber))

			b.WriteString("\n")

			// write exception type
			b.WriteString(fmt.Sprintf("Exception Type: %s\n", exception.Signal))

			// write exception codes
			b.WriteString(fmt.Sprintf("Exception Codes: #%d at 0x%s\n", exception.ThreadSequence, exception.Frames[exception.ThreadSequence].SymbolAddress))

			// write crashed thread
			b.WriteString(fmt.Sprintf("Crashed Thread: %d\n", exception.ThreadSequence))

			b.WriteString("\n")

			// write top level thread name
			if j == 0 && exception.ExceptionUnitiOS.ThreadName != "" {
				b.WriteString(exception.ExceptionUnitiOS.ThreadName + ":\n")
			}

			// write crashing thread's frames
			for _, frame := range exception.Frames {
				frameLine := fmt.Sprintf("%d    %s    0x%s 0x%s + %d\n", frame.FrameIndex, frame.BinaryName, frame.SymbolAddress, frame.BinaryAddress, frame.Offset)
				b.WriteString(frameLine)
			}
		}

		// write rest of the thread's frames
		for _, thread := range event.Exception.Threads {
			b.WriteString(thread.Name + "\n")
			for i, frame := range thread.Frames {
				frameLine := fmt.Sprintf("%d    %s    0x%s 0x%s + %d\n", frame.FrameIndex, frame.BinaryName, frame.SymbolAddress, frame.BinaryAddress, frame.Offset)
				b.WriteString(frameLine)

				// append extra newline after last
				// line
				if i == len(thread.Frames)-1 {
					b.WriteString("\n")
				}
			}
		}

		// write binary images
		for j, image := range event.Exception.BinaryImages {
			if j == 0 {
				b.WriteString("Binary Images:\n")
			}

			marker := "+"

			if image.System {
				marker = "-"
			}

			b.WriteString(fmt.Sprintf("       0x%s -        0x%s %s%s %s  <%s> %s\n", image.StartAddr, image.EndAddr, marker, image.Name, image.Arch, image.Uuid, image.Path))
		}
	}

	fmt.Println("report")
	fmt.Println(b.String())

	report = []byte(b.String())

	return
}
