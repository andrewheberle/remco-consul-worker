import { type Migration } from "workers-qb";

export const migration: Migration = {
	name: "0001_initial_schema",
	sql: `
		CREATE TABLE IF NOT EXISTS access_controls (
			id INTEGER PRIMARY KEY,
			user TEXT,
			prefix TEXT
		);

		CREATE INDEX IF NOT EXISTS idx_access_controls_user ON access_controls(user);
	`
}
