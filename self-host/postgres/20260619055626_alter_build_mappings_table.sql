-- migrate:up
alter table "measure"."build_mappings"
  alter column patch_id type text using coalesce(patch_id::text, ''),
  alter column patch_id set default '',
  alter column patch_id set not null;

-- migrate:down
alter table "measure"."build_mappings"
  alter column patch_id drop not null,
  alter column patch_id drop default,
  alter column patch_id type uuid using nullif(patch_id, '')::uuid;
