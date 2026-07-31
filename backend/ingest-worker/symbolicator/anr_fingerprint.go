package symbolicator

import (
	"crypto/md5"
	"encoding/hex"
	"regexp"
	"strconv"
	"strings"

	"backend/libs/event"
)

// anrTidRe extracts the thread id from a thread header line like
// `"main" prio=5 tid=1 Blocked`.
var anrTidRe = regexp.MustCompile(`\btid=(\d+)\b`)

// anrDumpThread is one thread block of a system thread dump reduced to
// what the fingerprint needs: its id, the frame it is blamed for, and
// the lock it is waiting on.
type anrDumpThread struct {
	tid                int
	blamedFrame        string
	blamedFrameIsInApp bool
	waitingToLockClass string
	heldByTid          int
}

// ANRDumpFingerprint groups a dump-carrying ANR by where the app was
// blocked:
//
//	md5(category:contendedClass:rootBlockingFrame:blockedFrame)
//
// with every component degrading to empty when absent. Returns false
// for an ANR with no dump or no captured frame, leaving the caller on
// the SDK-capture fingerprint.
//
// The blocked frame comes from the SDK's own capture, taken in process
// from the main looper, so no thread is identified by name or by
// position in the dump. The dump contributes the lock that thread waits
// on and the frame of the thread holding it.
//
// The category names which system deadline expired rather than what the
// app did, and one blocked main thread trips several of them: a service
// start, a queued job and the next tap all time out on the same stall.
// Grouping by it would split a single defect several ways, so it only
// participates when the blocked frame belongs to the platform and there
// is nothing more specific to group on.
//
// Call after symbolication, so every component is a deobfuscated name.
func ANRDumpFingerprint(anr *event.ANR) (fingerprint string, ok bool) {
	if anr == nil || anr.ThreadDump == "" {
		return "", false
	}
	if len(anr.Exceptions) == 0 || anr.HasNoFrames() {
		return "", false
	}

	blocked := anr.GetRelevantFrame()
	blockedFrame := anrFrameKey(blocked.ClassName+"."+blocked.MethodName, blocked.FileName)

	contendedClass := ""
	rootBlockingFrame := ""
	threads := parseAnrDumpThreads(anr.ThreadDump)
	if blockedThread := findAnrThread(threads, blockedFrame); blockedThread != nil {
		contendedClass = blockedThread.waitingToLockClass
		if holder := findAnrThreadByTid(threads, blockedThread.heldByTid); holder != nil {
			rootBlockingFrame = holder.blamedFrame
		}
	}

	category := ""
	if !blocked.InApp {
		category = anrCategory(anr.Subject)
	}

	data := category + ":" + contendedClass + ":" + rootBlockingFrame + ":" + blockedFrame
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:]), true
}

// anrCategory normalizes the system's subject line to the component the
// ANR timed out in. The forms mirror the reason strings the platform
// documents: an input dispatch timeout or a missing focused window, a
// broadcast, a service start, a content provider query, and a job
// callback. Empty stays empty so an absent subject degrades like every
// other fingerprint component.
func anrCategory(subject string) string {
	if subject == "" {
		return ""
	}
	s := strings.ToLower(subject)
	switch {
	case strings.Contains(s, "input dispatching timed out"),
		strings.Contains(s, "no focused window"):
		return "input_dispatch"
	case strings.Contains(s, "broadcast of intent"):
		return "broadcast"
	case strings.Contains(s, "executing service"):
		return "service"
	case strings.Contains(s, "contentprovider not responding"),
		strings.Contains(s, "content provider not responding"):
		return "content_provider"
	case strings.Contains(s, "onstartjob"),
		strings.Contains(s, "onstopjob"):
		return "job"
	default:
		return "unknown"
	}
}

// parseAnrDumpThreads reduces each thread block of the dump to the
// frame it is blamed for and the lock it waits on.
func parseAnrDumpThreads(dump string) []anrDumpThread {
	var threads []anrDumpThread

	for _, line := range strings.Split(dump, "\n") {
		if isAppExitThreadHeader(line) {
			thread := anrDumpThread{}
			if m := anrTidRe.FindStringSubmatch(line); m != nil {
				thread.tid, _ = strconv.Atoi(m[1])
			}
			threads = append(threads, thread)
			continue
		}
		if len(threads) == 0 {
			continue
		}
		current := &threads[len(threads)-1]

		if m := appExitFrameRe.FindStringSubmatch(line); m != nil {
			if current.blamedFrameIsInApp {
				continue
			}
			callee := m[2]
			fileName, _ := parseAppExitLocation(m[3])
			frame := anrFrameKey(callee, fileName)

			// A thread parked in Thread.sleep or Object.wait blames a
			// frame shared with every unrelated ANR parked the same way,
			// so the first app frame wins and the topmost frame is only
			// a fallback for a thread that has none.
			if isInAppCallee(callee) {
				current.blamedFrame = frame
				current.blamedFrameIsInApp = true
			} else if current.blamedFrame == "" {
				current.blamedFrame = frame
			}
			continue
		}

		if m := appExitMonitorRe.FindStringSubmatch(line); m != nil {
			if m[1] == "waiting to lock" && current.waitingToLockClass == "" {
				current.waitingToLockClass = m[2]
				current.heldByTid, _ = strconv.Atoi(m[3])
			}
		}
	}

	return threads
}

func findAnrThread(threads []anrDumpThread, blamedFrame string) *anrDumpThread {
	for i := range threads {
		if threads[i].blamedFrame == blamedFrame {
			return &threads[i]
		}
	}
	return nil
}

func findAnrThreadByTid(threads []anrDumpThread, tid int) *anrDumpThread {
	if tid <= 0 {
		return nil
	}
	for i := range threads {
		if threads[i].tid == tid {
			return &threads[i]
		}
	}
	return nil
}

// isInAppCallee reports whether a dump frame's `class.method` belongs to
// the app.
func isInAppCallee(callee string) bool {
	dot := strings.LastIndex(callee, ".")
	if dot <= 0 {
		return false
	}
	return event.IsInApp(callee[:dot])
}

// anrFrameKey renders a frame as `class.method(file)` for comparing
// frames across the capture and the dump. The line number is left out
// so a group survives unrelated edits to the file.
//
// The placeholders the dump uses for a frame with no source file are
// blanked, since the capture leaves the same frame's file empty and the
// two keys have to match.
func anrFrameKey(callee, fileName string) string {
	if strings.EqualFold(fileName, "native method") ||
		strings.EqualFold(fileName, "unknown source") {
		fileName = ""
	}
	return callee + "(" + fileName + ")"
}
