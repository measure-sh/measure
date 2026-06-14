-- migrate:up
alter table "measure"."build_mappings"
  add column if not exists patch_id UUID;

-- migrate:down
alter table "meausre"."build_mappings"
  drop column if exists patch_id;
