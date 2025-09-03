-- migrate:up
alter table events
comment column if exists `attribute.device_cpu_arch` 'cpu architecture like arm64 and so on',
comment column if exists `lifecycle_view_controller.type` 'type of the iOS ViewController lifecycle event',
comment column if exists `lifecycle_view_controller.class_name` 'class name of the iOS ViewController lifecycle event',
comment column if exists `lifecycle_swift_ui.type` 'type of the iOS SwiftUI view lifecycle event',
comment column if exists `lifecycle_swift_ui.class_name` 'class name of the iOS SwiftUI view lifecycle event',
comment column if exists `memory_usage_absolute.max_memory` 'maximum memory available to the application, in KiB',
comment column if exists `memory_usage_absolute.used_memory` 'used memory by the application, in KiB',
comment column if exists `memory_usage_absolute.interval` 'interval between two consecutive readings';

-- migrate:down
alter table events
modify column if exists `attribute.device_cpu_arch` 'cpu architecture like arm64 and so on' remove comment,
modify column if exists `lifecycle_view_controller.type` 'type of the iOS ViewController lifecycle event' remove comment,
modify column if exists `lifecycle_view_controller.class_name` 'class name of the iOS ViewController lifecycle event' remove comment,
modify column if exists `lifecycle_swift_ui.type` 'type of the iOS SwiftUI view lifecycle event' remove comment,
modify column if exists `lifecycle_swift_ui.class_name` 'class name of the iOS SwiftUI view lifecycle event' remove comment,
modify column if exists `memory_usage_absolute.max_memory` 'maximum memory available to the application, in KiB' remove comment,
modify column if exists `memory_usage_absolute.used_memory` 'used memory by the application, in KiB' remove comment,
modify column if exists `memory_usage_absolute.interval` 'interval between two consecutive readings' remove comment;
