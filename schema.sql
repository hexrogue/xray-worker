CREATE TABLE users (
	uuid TEXT PRIMARY KEY NOT NULL UNIQUE,
	email TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	expired_at INTEGER
);

INSERT INTO TABLE users (
	uuid,
	email,
	created_at,
	expired_at
) values ('0fc57354-40a0-4cef-9064-6e8d491ed8be', 'love@example.com', 31557600000, 3155760000000);
