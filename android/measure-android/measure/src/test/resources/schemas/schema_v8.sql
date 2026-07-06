CREATE TABLE sessions (
            session_id TEXT PRIMARY KEY,
            pid INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            app_exit_tracked INTEGER DEFAULT 0,
            needs_reporting INTEGER DEFAULT 0,
            crashed INTEGER DEFAULT 0,
            track_journey INTEGER DEFAULT 0,
            app_version TEXT DEFAULT NULL,
            app_build TEXT DEFAULT NULL
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
            sampled INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
CREATE TABLE attachments_v1 (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            event_id TEXT NOT NULL,
            type TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            file_path TEXT DEFAULT NULL,
            name TEXT DEFAULT NULL,
            url TEXT DEFAULT NULL,
            url_expires_at TEXT DEFAULT NULL,
            headers TEXT DEFAULT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
CREATE TABLE batches (
            batch_id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
        );
CREATE TABLE events_batch (
            event_id TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (event_id, batch_id),
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
CREATE TABLE spans (
            span_id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            session_id TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            parent_id TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            duration INTEGER NOT NULL,
            status TEXT NOT NULL,
            serialized_attrs TEXT,
            user_defined_attributes TEXT,
            serialized_span_events TEXT,
            sampled INTEGER DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
CREATE TABLE spans_batch (
            span_id TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (span_id, batch_id),
            FOREIGN KEY (span_id) REFERENCES spans(span_id) ON DELETE CASCADE
        );
CREATE INDEX events_timestamp_index ON events (timestamp);
CREATE INDEX events_session_id_index ON events (session_id);
CREATE INDEX events_batch_event_id_index ON events_batch (event_id);
CREATE INDEX sessions_created_at_index ON sessions (created_at);
CREATE INDEX idx_spans_session_sampled_starttime ON spans(session_id, sampled, start_time);
CREATE INDEX idx_spans_batch_span_id ON spans_batch(span_id);
CREATE INDEX sessions_pid_created_at_index ON sessions(pid, created_at DESC);
