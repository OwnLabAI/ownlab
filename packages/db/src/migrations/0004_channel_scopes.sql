-- 0004_channel_scopes.sql
-- Introduce unified channel scopes and indexes.

ALTER TABLE "channels"
ADD COLUMN IF NOT EXISTS "scope_type" text NOT NULL DEFAULT 'workspace',
ADD COLUMN IF NOT EXISTS "scope_ref_id" text;

CREATE INDEX IF NOT EXISTS "channels_scope_idx"
  ON "channels" USING btree ("scope_type","scope_ref_id");

