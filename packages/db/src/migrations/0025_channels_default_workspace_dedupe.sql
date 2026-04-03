WITH ranked_channels AS (
  SELECT
    id,
    workspace_id,
    scope_type,
    scope_ref_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number,
    FIRST_VALUE(id) OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM "channels"
  WHERE "scope_type" = 'workspace'
    AND "scope_ref_id" = "workspace_id"::text
),
duplicate_channels AS (
  SELECT id, canonical_id
  FROM ranked_channels
  WHERE row_number > 1
)
INSERT INTO "channel_members" (
  "channel_id",
  "actor_id",
  "actor_type",
  "runtime_state",
  "runtime_updated_at",
  "joined_at"
)
SELECT
  duplicate_channels.canonical_id,
  channel_members."actor_id",
  channel_members."actor_type",
  channel_members."runtime_state",
  channel_members."runtime_updated_at",
  channel_members."joined_at"
FROM duplicate_channels
INNER JOIN "channel_members" ON "channel_members"."channel_id" = duplicate_channels.id
ON CONFLICT ("channel_id", "actor_id") DO NOTHING;
--> statement-breakpoint
WITH ranked_channels AS (
  SELECT
    id,
    workspace_id,
    scope_type,
    scope_ref_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number,
    FIRST_VALUE(id) OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM "channels"
  WHERE "scope_type" = 'workspace'
    AND "scope_ref_id" = "workspace_id"::text
),
duplicate_channels AS (
  SELECT id, canonical_id
  FROM ranked_channels
  WHERE row_number > 1
)
UPDATE "channel_messages"
SET "channel_id" = duplicate_channels.canonical_id
FROM duplicate_channels
WHERE "channel_messages"."channel_id" = duplicate_channels.id;
--> statement-breakpoint
WITH ranked_channels AS (
  SELECT
    id,
    workspace_id,
    scope_type,
    scope_ref_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number,
    FIRST_VALUE(id) OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM "channels"
  WHERE "scope_type" = 'workspace'
    AND "scope_ref_id" = "workspace_id"::text
),
duplicate_channels AS (
  SELECT id
  FROM ranked_channels
  WHERE row_number > 1
)
DELETE FROM "channel_members"
USING duplicate_channels
WHERE "channel_members"."channel_id" = duplicate_channels.id;
--> statement-breakpoint
WITH ranked_channels AS (
  SELECT
    id,
    workspace_id,
    scope_type,
    scope_ref_id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, scope_type, scope_ref_id
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM "channels"
  WHERE "scope_type" = 'workspace'
    AND "scope_ref_id" = "workspace_id"::text
),
duplicate_channels AS (
  SELECT id
  FROM ranked_channels
  WHERE row_number > 1
)
DELETE FROM "channels"
USING duplicate_channels
WHERE "channels"."id" = duplicate_channels.id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channels_workspace_scope_ref_unique_idx"
ON "channels" USING btree ("workspace_id", "scope_type", "scope_ref_id");
