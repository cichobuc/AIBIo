CREATE TABLE `column_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`data_source_id` text NOT NULL,
	`table_name` text NOT NULL,
	`column_name` text NOT NULL,
	`pii_candidate` integer DEFAULT false NOT NULL,
	`pii_candidate_reason` text,
	`pii_classification` text,
	`pii_subtype` text,
	`set_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`data_source_id`) REFERENCES `data_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `column_metadata_source_table_col_uidx` ON `column_metadata` (`data_source_id`,`table_name`,`column_name`);
--> statement-breakpoint
CREATE INDEX `column_metadata_pii_idx` ON `column_metadata` (`data_source_id`,`table_name`,`pii_classification`);
--> statement-breakpoint
INSERT INTO `column_metadata` (
	id, data_source_id, table_name, column_name,
	pii_candidate, pii_candidate_reason,
	pii_classification, pii_subtype, set_by,
	created_at, updated_at
)
SELECT
	lower(hex(randomblob(16))) AS id,
	k.data_source_id, k.table_name, k.column_name,
	COALESCE(cp.pii_candidate, 0) AS pii_candidate,
	cp.pii_candidate_reason AS pii_candidate_reason,
	cperm.pii_classification AS pii_classification,
	cperm.pii_subtype AS pii_subtype,
	COALESCE(cperm.set_by, 'heuristic') AS set_by,
	COALESCE(cperm.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS created_at,
	COALESCE(cperm.updated_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS updated_at
FROM (
	SELECT data_source_id, table_name, column_name FROM column_profiles
	UNION
	SELECT data_source_id, table_name, column_name FROM column_permissions
) AS k
LEFT JOIN column_profiles cp
	ON cp.data_source_id = k.data_source_id
	AND cp.table_name = k.table_name
	AND cp.column_name = k.column_name
LEFT JOIN column_permissions cperm
	ON cperm.data_source_id = k.data_source_id
	AND cperm.table_name = k.table_name
	AND cperm.column_name = k.column_name;
