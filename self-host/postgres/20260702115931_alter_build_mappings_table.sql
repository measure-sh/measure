-- migrate:up
alter table "measure"."build_mappings" drop column if exists patch_id;
alter table "measure"."build_mappings" add column patch_id uuid not null default '00000000-0000-0000-0000-000000000000';

-- migrate:down
alter table "measure"."build_mappings" drop column if exists patch_id;
alter table "measure"."build_mappings" add column patch_id text not null default '';
