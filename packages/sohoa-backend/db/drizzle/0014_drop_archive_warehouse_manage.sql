-- Chạy tay trên DB (schema sohoa_app).
-- 1) ACL manage → edit/delete/reupload (+ copy principals)
-- 2) Role rules: thay manage bằng edit/delete/reupload

BEGIN;

DO $$
DECLARE
  manage_row RECORD;
  target_key text;
  new_entry_id uuid;
BEGIN
  FOR manage_row IN
    SELECT id, resource_kind, resource_id
    FROM sohoa_app.archive_acl_entries
    WHERE permission_key = 'archive.warehouse.manage'
  LOOP
    FOREACH target_key IN ARRAY ARRAY[
      'archive.warehouse.edit',
      'archive.warehouse.delete',
      'archive.warehouse.reupload'
    ]
    LOOP
      SELECT id INTO new_entry_id
      FROM sohoa_app.archive_acl_entries
      WHERE resource_kind = manage_row.resource_kind
        AND resource_id = manage_row.resource_id
        AND permission_key = target_key;

      IF new_entry_id IS NULL THEN
        INSERT INTO sohoa_app.archive_acl_entries (resource_kind, resource_id, permission_key)
        VALUES (manage_row.resource_kind, manage_row.resource_id, target_key)
        RETURNING id INTO new_entry_id;
      END IF;

      INSERT INTO sohoa_app.archive_acl_principals (entry_id, principal_kind, principal_id)
      SELECT new_entry_id, p.principal_kind, p.principal_id
      FROM sohoa_app.archive_acl_principals p
      WHERE p.entry_id = manage_row.id
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  DELETE FROM sohoa_app.archive_acl_entries
  WHERE permission_key = 'archive.warehouse.manage';
END $$;

DO $$
DECLARE
  role_row RECORD;
  perms text[];
  next_perms text[];
  has_manage boolean;
BEGIN
  FOR role_row IN
    SELECT id, rules
    FROM sohoa_app.roles
    WHERE deleted_at IS NULL
      AND rules LIKE '%archive.warehouse.manage%'
  LOOP
    SELECT COALESCE(array_agg(p), ARRAY[]::text[])
    INTO perms
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(COALESCE(role_row.rules::jsonb -> 'permissions', '[]'::jsonb)) = 'array'
        THEN COALESCE(role_row.rules::jsonb -> 'permissions', '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS p;

    has_manage := 'archive.warehouse.manage' = ANY (perms);
    next_perms := ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        array_remove(perms, 'archive.warehouse.manage')
        || CASE
          WHEN has_manage THEN ARRAY[
            'archive.warehouse.edit',
            'archive.warehouse.delete',
            'archive.warehouse.reupload'
          ]
          ELSE ARRAY[]::text[]
        END
      ) AS x
      ORDER BY x
    );

    UPDATE sohoa_app.roles
    SET rules = jsonb_build_object(
      'permissions', to_jsonb(next_perms),
      'restrictions', COALESCE(role_row.rules::jsonb -> 'restrictions', '[]'::jsonb)
    )::text
    WHERE id = role_row.id;
  END LOOP;
END $$;

-- Nếu dùng drizzle migrate sau này: đánh dấu migration đã apply (bỏ comment nếu cần)
-- INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
-- SELECT '...', EXTRACT(EPOCH FROM now())::bigint * 1000
-- WHERE NOT EXISTS (...);

COMMIT;
