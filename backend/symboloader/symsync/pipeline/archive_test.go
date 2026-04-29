package pipeline

import "testing"

func TestParseArchiveFilename(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		want     ArchiveInfo
		wantOK   bool
	}{
		// Space-style, arm64e
		{
			name:     "space style arm64e simple",
			filename: "18.1 (22B83) arm64e.7z",
			want:     ArchiveInfo{Version: "18.1", Build: "22B83", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "space style arm64e three-part version",
			filename: "18.3.1 (22D72) arm64e.7z",
			want:     ArchiveInfo{Version: "18.3.1", Build: "22D72", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "space style arm64e long build number",
			filename: "26.3.1 (23D8133) arm64e.7z",
			want:     ArchiveInfo{Version: "26.3.1", Build: "23D8133", Arch: "arm64e"},
			wantOK:   true,
		},

		// Space-style, arm64
		{
			name:     "space style arm64",
			filename: "15.0.2 (19A404) arm64.7z",
			want:     ArchiveInfo{Version: "15.0.2", Build: "19A404", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "space style arm64 many-patch version",
			filename: "16.7.10 (20H350) arm64.7z",
			want:     ArchiveInfo{Version: "16.7.10", Build: "20H350", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "space style arm64 high patch number",
			filename: "15.8.7 (19H411) arm64.7z",
			want:     ArchiveInfo{Version: "15.8.7", Build: "19H411", Arch: "arm64"},
			wantOK:   true,
		},

		// Space-style, no arch — defaults to arm64
		{
			name:     "space style no arch defaults to arm64",
			filename: "13.0 (17A577).7z",
			want:     ArchiveInfo{Version: "13.0", Build: "17A577", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "space style no arch three-part version",
			filename: "13.1.2 (17A861).7z",
			want:     ArchiveInfo{Version: "13.1.2", Build: "17A861", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "space style no arch early ios12",
			filename: "12.0 (16A366).7z",
			want:     ArchiveInfo{Version: "12.0", Build: "16A366", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "space style no arch multiple same build",
			filename: "12.0.1 (16A405).7z",
			want:     ArchiveInfo{Version: "12.0.1", Build: "16A405", Arch: "arm64"},
			wantOK:   true,
		},

		// Space-style, beta builds with lowercase suffix in build number
		{
			name:     "space style beta build lowercase suffix m",
			filename: "18.0 (22A5282m) arm64e.7z",
			want:     ArchiveInfo{Version: "18.0", Build: "22A5282m", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "space style beta build lowercase suffix f",
			filename: "18.0 (22A5307f) arm64e.7z",
			want:     ArchiveInfo{Version: "18.0", Build: "22A5307f", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "space style beta build lowercase suffix p",
			filename: "18.1 (22B5007p) arm64e.7z",
			want:     ArchiveInfo{Version: "18.1", Build: "22B5007p", Arch: "arm64e"},
			wantOK:   true,
		},

		// Underscore-style, arm64
		{
			name:     "underscore style arm64 two-part version",
			filename: "14.0_18A373(arm64).7z",
			want:     ArchiveInfo{Version: "14.0", Build: "18A373", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "underscore style arm64 three-part version",
			filename: "14.4.2_18D70(arm64).7z",
			want:     ArchiveInfo{Version: "14.4.2", Build: "18D70", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "underscore style arm64 ios15",
			filename: "15.0_19A346(arm64).7z",
			want:     ArchiveInfo{Version: "15.0", Build: "19A346", Arch: "arm64"},
			wantOK:   true,
		},
		{
			name:     "underscore style arm64 ios12",
			filename: "12.4.6_16G183(arm64).7z",
			want:     ArchiveInfo{Version: "12.4.6", Build: "16G183", Arch: "arm64"},
			wantOK:   true,
		},

		// Underscore-style, arm64e
		{
			name:     "underscore style arm64e",
			filename: "14.0_18A373(arm64e).7z",
			want:     ArchiveInfo{Version: "14.0", Build: "18A373", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "underscore style arm64e three-part version",
			filename: "14.4.2_18D70(arm64e).7z",
			want:     ArchiveInfo{Version: "14.4.2", Build: "18D70", Arch: "arm64e"},
			wantOK:   true,
		},
		{
			name:     "underscore style arm64e long build number",
			filename: "13.4.1_17E8258(arm64e).7z",
			want:     ArchiveInfo{Version: "13.4.1", Build: "17E8258", Arch: "arm64e"},
			wantOK:   true,
		},

		// Invalid inputs
		{
			name:     "not a 7z file",
			filename: "18.0 (22A3351) arm64e.zip",
			wantOK:   false,
		},
		{
			name:     "missing build number parens",
			filename: "18.0 22A3351 arm64e.7z",
			wantOK:   false,
		},
		{
			name:     "empty string",
			filename: "",
			wantOK:   false,
		},
		{
			name:     "unknown arch",
			filename: "18.0 (22A3351) x86_64.7z",
			wantOK:   false,
		},
		{
			name:     "random string",
			filename: "somefile.7z",
			wantOK:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ParseArchiveFilename(tt.filename)
			if ok != tt.wantOK {
				t.Fatalf("ParseArchiveFilename(%q): ok = %v, want %v", tt.filename, ok, tt.wantOK)
			}
			if !tt.wantOK {
				return
			}
			if got.Version != tt.want.Version {
				t.Errorf("Version = %q, want %q", got.Version, tt.want.Version)
			}
			if got.Build != tt.want.Build {
				t.Errorf("Build = %q, want %q", got.Build, tt.want.Build)
			}
			if got.Arch != tt.want.Arch {
				t.Errorf("Arch = %q, want %q", got.Arch, tt.want.Arch)
			}
		})
	}
}
