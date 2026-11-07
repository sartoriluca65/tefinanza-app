-- Solo tabelle additive; nessuna cancellazione o modifica di ciphertext esistenti.
CREATE TABLE IF NOT EXISTS revisions (
 user_id TEXT NOT NULL, revision INTEGER NOT NULL, operation_id TEXT NOT NULL,
 object_key TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(user_id,revision), UNIQUE(user_id,operation_id)
);
CREATE TABLE IF NOT EXISTS conflict_copies (
 user_id TEXT NOT NULL, operation_id TEXT NOT NULL, base_revision INTEGER NOT NULL,
 object_key TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(user_id,operation_id)
);
CREATE TABLE IF NOT EXISTS sync_keys (
 user_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
