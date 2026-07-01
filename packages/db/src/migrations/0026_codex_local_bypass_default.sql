UPDATE "agents"
SET
  "adapter_config" = jsonb_set(
    COALESCE("adapter_config", '{}'::jsonb),
    '{dangerouslyBypassApprovalsAndSandbox}',
    'true'::jsonb,
    true
  ),
  "updated_at" = NOW()
WHERE "adapter_type" = 'codex_local'
  AND COALESCE("adapter_config"->>'dangerouslyBypassApprovalsAndSandbox', 'false') = 'false';
