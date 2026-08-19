package event

import (
	"encoding/json"
	"testing"
)

func TestComputeViewThreadsFrames(t *testing.T) {
	const wantWithThread = `[{"name":"main","frames":[]}]`
	const wantEmpty = `[]`

	tests := []struct {
		name string
		want string
		run  func() []ThreadView
	}{
		{
			name: "exception apple framework",
			want: wantWithThread,
			run: func() []ThreadView {
				e := EventException{
					Exception: Exception{
						Framework:  FrameworkApple,
						Exceptions: ExceptionUnits{{Type: "SIGSEGV", ExceptionUnitiOS: &ExceptionUnitiOS{Signal: "SIGSEGV"}}},
						Threads:    Threads{{Name: "main", Frames: Frames{}}},
					},
				}
				e.ComputeView()
				return e.Threads
			},
		},
		{
			name: "exception default framework",
			want: wantWithThread,
			run: func() []ThreadView {
				e := EventException{
					Exception: Exception{
						Exceptions: ExceptionUnits{{Type: "NullPointerException"}},
						Threads:    Threads{{Name: "main", Frames: Frames{}}},
					},
				}
				e.ComputeView()
				return e.Threads
			},
		},
		{
			name: "anr",
			want: wantWithThread,
			run: func() []ThreadView {
				e := EventANR{
					ANR: ANR{
						Exceptions: ExceptionUnits{{Type: "ANR"}},
						Threads:    Threads{{Name: "main", Frames: Frames{}}},
					},
				}
				e.ComputeView()
				return e.Threads
			},
		},
		{
			name: "exception zero threads",
			want: wantEmpty,
			run: func() []ThreadView {
				e := EventException{
					Exception: Exception{Exceptions: ExceptionUnits{{Type: "NullPointerException"}}},
				}
				e.ComputeView()
				return e.Threads
			},
		},
		{
			name: "anr zero threads",
			want: wantEmpty,
			run: func() []ThreadView {
				e := EventANR{ANR: ANR{Exceptions: ExceptionUnits{{Type: "ANR"}}}}
				e.ComputeView()
				return e.Threads
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := json.Marshal(tt.run())
			if err != nil {
				t.Fatalf("json.Marshal() error = %v", err)
			}
			if string(got) != tt.want {
				t.Errorf("json.Marshal() = %s, want %s", got, tt.want)
			}
		})
	}
}
