CREATE TABLE source_discovery_checkpoints (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_task_id text NOT NULL,
  mode text NOT NULL,
  page_index bigint NOT NULL,
  next_cursor text,
  next_page bigint,
  cumulative_requests bigint NOT NULL,
  cumulative_pages bigint NOT NULL,
  cumulative_bytes bigint NOT NULL,
  cumulative_currency_micros bigint NOT NULL,
  cumulative_runtime_ms bigint NOT NULL,
  coverage_state text NOT NULL,
  returned_records bigint NOT NULL,
  terminal boolean NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_discovery_checkpoints_workspace_task_unique UNIQUE (workspace_id, source_task_id),
  CONSTRAINT source_discovery_checkpoints_id_check
    CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT source_discovery_checkpoints_task_id_check
    CHECK (source_task_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  CONSTRAINT source_discovery_checkpoints_mode_check CHECK (mode IN ('cursor', 'page')),
  CONSTRAINT source_discovery_checkpoints_page_index_check CHECK (page_index >= 0 AND page_index <= 9007199254740991),
  CONSTRAINT source_discovery_checkpoints_next_cursor_check CHECK (next_cursor IS NULL OR length(next_cursor) <= 4096),
  CONSTRAINT source_discovery_checkpoints_next_page_check CHECK (next_page IS NULL OR (next_page >= 1 AND next_page <= 9007199254740991)),
  CONSTRAINT source_discovery_checkpoints_usage_check CHECK (
    cumulative_requests >= 0 AND cumulative_requests <= 9007199254740991
    AND cumulative_pages >= 0 AND cumulative_pages <= 9007199254740991
    AND cumulative_bytes >= 0 AND cumulative_bytes <= 9007199254740991
    AND cumulative_currency_micros >= 0 AND cumulative_currency_micros <= 9007199254740991
    AND cumulative_runtime_ms >= 0 AND cumulative_runtime_ms <= 9007199254740991
  ),
  CONSTRAINT source_discovery_checkpoints_coverage_check CHECK (coverage_state IN ('complete', 'partial', 'unknown')),
  CONSTRAINT source_discovery_checkpoints_returned_records_check CHECK (returned_records >= 0 AND returned_records <= 9007199254740991),
  CONSTRAINT source_discovery_checkpoints_version_check CHECK (version >= 1 AND version <= 9007199254740991),
  CONSTRAINT source_discovery_checkpoints_mode_state_check CHECK (
    (mode = 'cursor' AND next_page IS NULL)
    OR (mode = 'page' AND next_cursor IS NULL)
  ),
  CONSTRAINT source_discovery_checkpoints_terminal_state_check CHECK (
    (terminal AND next_cursor IS NULL AND next_page IS NULL)
    OR (NOT terminal AND ((mode = 'cursor' AND next_cursor IS NOT NULL) OR (mode = 'page' AND next_page IS NOT NULL)))
  ),
  CONSTRAINT source_discovery_checkpoints_task_fk
    FOREIGN KEY (source_task_id, workspace_id)
    REFERENCES source_tasks (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX source_discovery_checkpoints_workspace_updated_idx
  ON source_discovery_checkpoints (workspace_id, updated_at DESC, source_task_id);
