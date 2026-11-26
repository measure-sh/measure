-- migrate:up
alter table measure.sdk_config
  add column if not exists layout_snapshot_click_enabled boolean not null default true,
  add column if not exists layout_snapshot_screen_view_enabled boolean not null default true;

comment on column measure.sdk_config.layout_snapshot_click_enabled is 'whether to take a layout snapshot on clicks and long clicks';
comment on column measure.sdk_config.layout_snapshot_screen_view_enabled is 'whether to take a layout snapshot on screen views, screen lifecycle changes and app background';

-- migrate:down
alter table measure.sdk_config
  drop column if exists layout_snapshot_click_enabled,
  drop column if exists layout_snapshot_screen_view_enabled;
