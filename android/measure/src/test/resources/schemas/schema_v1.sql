CREATE TABLE sessions (
            session_id TEXT PRIMARY KEY,
            pid INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            app_exit_tracked INTEGER DEFAULT 0,
            needs_reporting INTEGER DEFAULT 0,
            crashed INTEGER DEFAULT 0
        );
CREATE TABLE events (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            session_id TEXT NOT NULL,
            user_triggered INTEGER NOT NULL DEFAULT 0,
            file_path TEXT DEFAULT NULL,
            serialized_data TEXT DEFAULT NULL,
            attributes TEXT DEFAULT NULL,
            user_defined_attributes TEXT DEFAULT NULL,
            attachments_size INTEGER NOT NULL,
            attachments TEXT DEFAULT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
CREATE TABLE attachments (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            type TEXT NOT NULL,a
            timestamp TEXT NOT NULL,
            session_id TEXT NOT NULL,
            file_path TEXT DEFAULT NULL,
            name TEXT DEFAULT NULL,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
CREATE TABLE events_batch (
            event_id TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (event_id, batch_id),
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
CREATE TABLE user_defined_attributes (
            key TEXT PRIMARY KEY,
            value TEXT,
            type TEXT NOT NULL
        );
CREATE INDEX events_timestamp_index ON events (timestamp);
CREATE INDEX events_session_id_index ON events (session_id);
CREATE INDEX events_batch_event_id_index ON events_batch (event_id);
CREATE INDEX sessions_created_at_index ON sessions (created_at);
CREATE INDEX sessions_needs_reporting_index ON sessions (needs_reporting);
