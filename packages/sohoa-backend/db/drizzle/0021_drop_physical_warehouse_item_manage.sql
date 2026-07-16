-- Gộp physical-warehouse.item.manage vào physical-warehouse.item.read

BEGIN;

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
      AND rules LIKE '%physical-warehouse.item.manage%'
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

    has_manage := 'physical-warehouse.item.manage' = ANY (perms);
    next_perms := ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        array_remove(perms, 'physical-warehouse.item.manage')
        || CASE
          WHEN has_manage THEN ARRAY['physical-warehouse.item.read']
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

COMMIT;
