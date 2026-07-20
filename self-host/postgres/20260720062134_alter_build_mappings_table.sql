-- migrate:up
alter table "measure"."build_mappings" add column if not exists patch_version varchar(256) not null default '';
comment on column measure.build_mappings.patch_version is 'human-facing OTA patch version, free-form, optional, not used for symbolication';

-- migrate:down
alter table "measure"."build_mappings" drop column if exists patch_version;
