-- migrate:up
alter table events
  add column if not exists `gesture_long_click.label` String comment 'visible text of the clicked element' CODEC(ZSTD(3)) after `gesture_long_click.target_id`,
  add column if not exists `gesture_long_click.semantic_label` String comment 'accessibility label of the clicked element' CODEC(ZSTD(3)) after `gesture_long_click.label`,
  add column if not exists `gesture_click.label` String comment 'visible text of the clicked element' CODEC(ZSTD(3)) after `gesture_click.target_id`,
  add column if not exists `gesture_click.semantic_label` String comment 'accessibility label of the clicked element' CODEC(ZSTD(3)) after `gesture_click.label`;

-- migrate:down
alter table events
  drop column if exists `gesture_long_click.label`,
  drop column if exists `gesture_long_click.semantic_label`,
  drop column if exists `gesture_click.label`,
  drop column if exists `gesture_click.semantic_label`;
