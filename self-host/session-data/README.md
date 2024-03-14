## Session Data

This directory contains sample session data generated from different apps.

### Directory Structure

* Each directory represents an app.
* Each app directory **MUST** contain at least one version directory.
* Each version directory **MUST** contain the session json files. The session file name is same as the session id.
* Each version directory **MAY** contain a `mapping.txt` file. This file contains the mapping between the obfuscated and original class names.
* Each version directory **MUST** contain a `build.toml` file. This file contains the build size information.


```
├── session-data
│  ├── acme-app-1
│  │  └── 1.0.0
│  │     ├── 54a0bbb9-e819-47f8-9168-5c201a3f3fc0.json
│  │     ├── 5784a496-0655-4fb5-b51b-2afc23e26cef.json
│  │     ├── 203334e1-2a7a-466b-b968-506ec3e23615.json
│  │     ├── build.toml
│  │     └── mapping.txt
│  ├── acme-app-2
│  │  └── 1.0.0
│  │     ├── 84a56646-e8dd-4745-90d5-0e9d1449ee5c.json
│  │     ├── 3140f4a9-38ed-42ba-8a4b-ee073b2cde83.json
│  │     ├── 6280cc4b-9b54-4fa2-98f6-02e325b2fa95.json
│  │     ├── build.toml
│  │     └── mapping.txt
│  │  └── 2.0.0
│  │     ├── 84a56646-e8dd-4745-90d5-0e9d1449ee5c.json
│  │     ├── 3140f4a9-38ed-42ba-8a4b-ee073b2cde83.json
│  │     ├── 6280cc4b-9b54-4fa2-98f6-02e325b2fa95.json
│  │     ├── build.toml
│  │     └── mapping.txt
│  └── acme-app-3
│     └── 1.0
│        ├── a59394af-e47c-4b34-bae9-ab805537a832.json
│        ├── ac906691-1981-419d-85da-0bb9ce298bdb.json
│        ├── c200b751-f368-435c-9338-9c6791d7db5a.json
│        ├── build.toml
│        └── mapping.txt
```