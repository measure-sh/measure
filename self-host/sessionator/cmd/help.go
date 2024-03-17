package cmd

// DirTree provides session data directory structure
// as a formatted string.
func DirTree() string {
	return `
.
├── foo-app
│  └── 1.2.3
│     ├── 54a0bbb9-e819-47f8-9168-5c201a3f3fc0.json
│     ├── 203334e1-2a7a-466b-b968-506ec3e23615.json
│     ├── build.toml
│     └── mapping.txt
│  └── 4.5.6
│     ├── 54a0bbb9-e819-47f8-9168-5c201a3f3fc0.json
│     ├── 5784a496-0655-4fb5-b51b-2afc23e26cef.json
│     ├── 203334e1-2a7a-466b-b968-506ec3e23615.json
│     ├── build.toml
├── bar-app
│  └── 1.2.3
│     ├── 54a0bbb9-e819-47f8-9168-5c201a3f3fc0.json
│     ├── 203334e1-2a7a-466b-b968-506ec3e23615.json
│     ├── build.toml
│     └── mapping.txt`
}

// ValidNote provides note about validity of files
// as a formatted string.
func ValidNote() string {
	return `
Note:

- ` + "`" + `mapping.txt` + "`	" + `is optional
- ` + "`" + `build.toml` + "`	" + `is required`
}
