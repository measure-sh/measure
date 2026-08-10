-- migrate:up
alter table spans
    add column if not exists `attribute.expo_update_id` UUID comment 'uuid of the currently running expo ota update' CODEC(ZSTD(3)) after `attribute.patch_version`,
    add column if not exists `attribute.expo_runtime_version` LowCardinality(String) comment 'runtime version of the expo update' CODEC(ZSTD(3)) after `attribute.expo_update_id`,
    add column if not exists `attribute.is_expo_embedded_launch` Bool comment 'true if the app launched from the embedded bundle' CODEC(ZSTD(3)) after `attribute.expo_runtime_version`,
    add column if not exists `attribute.is_expo_using_embedded_assets` Bool comment 'true if the app is using embedded assets' CODEC(ZSTD(3)) after `attribute.is_expo_embedded_launch`,
    add column if not exists `attribute.expo_automatic_update_policy` LowCardinality(String) comment 'policy set for expo automatic updates' CODEC(ZSTD(3)) after `attribute.is_expo_using_embedded_assets`,
    add column if not exists `attribute.expo_execution_environment` LowCardinality(String) comment 'where the app is running - storeClient, standalone or bare' CODEC(ZSTD(3)) after `attribute.expo_automatic_update_policy`,
    add column if not exists `attribute.expo_version` LowCardinality(String) comment 'expo client version' CODEC(ZSTD(3)) after `attribute.expo_execution_environment`,
    add column if not exists `attribute.expo_sdk_version` LowCardinality(String) comment 'expo sdk version' CODEC(ZSTD(3)) after `attribute.expo_version`,
    add column if not exists `attribute.expo_eas_project_id` LowCardinality(String) comment 'eas project identifier' CODEC(ZSTD(3)) after `attribute.expo_sdk_version`
settings mutations_sync = 2;

-- migrate:down
alter table spans
    drop column if exists `attribute.expo_update_id`,
    drop column if exists `attribute.expo_runtime_version`,
    drop column if exists `attribute.is_expo_embedded_launch`,
    drop column if exists `attribute.is_expo_using_embedded_assets`,
    drop column if exists `attribute.expo_automatic_update_policy`,
    drop column if exists `attribute.expo_execution_environment`,
    drop column if exists `attribute.expo_version`,
    drop column if exists `attribute.expo_sdk_version`,
    drop column if exists `attribute.expo_eas_project_id`
settings mutations_sync = 2;
