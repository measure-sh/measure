-- migrate:up
alter table events
  drop column if exists `low_memory.java_max_heap`,
  drop column if exists `low_memory.java_total_heap`,
  drop column if exists `low_memory.java_free_heap`,
  drop column if exists `low_memory.total_pss`,
  drop column if exists `low_memory.rss`,
  drop column if exists `low_memory.native_total_heap`,
  drop column if exists `low_memory.native_free_heap`
settings mutations_sync = 2;

-- migrate:down
alter table events
  add column if not exists `low_memory.java_max_heap` UInt64 comment 'maximum size of the java heap allocated, in kb' CODEC(T64, ZSTD(3)) after `memory_usage_absolute.interval`,
  add column if not exists `low_memory.java_total_heap` UInt64 comment 'total size of the java heap available for allocation, in kb' CODEC(T64, ZSTD(3)) after `low_memory.java_max_heap`,
  add column if not exists `low_memory.java_free_heap` UInt64 comment 'free memory available in the java heap, in kb' CODEC(T64, ZSTD(3)) after `low_memory.java_total_heap`,
  add column if not exists `low_memory.total_pss` UInt64 comment 'total proportional set size - amount of memory used by the process, including shared memory and code. in kb.' CODEC(T64, ZSTD(3)) after `low_memory.java_free_heap`,
  add column if not exists `low_memory.rss` UInt64 comment 'resident set size - amount of physical memory currently used, in kb' CODEC(T64, ZSTD(3)) after `low_memory.total_pss`,
  add column if not exists `low_memory.native_total_heap` UInt64 comment 'total size of the native heap (memory out of java' CODEC(T64, ZSTD(3)) after `low_memory.rss`,
  add column if not exists `low_memory.native_free_heap` UInt64 comment 'amount of free memory available in the native heap, in kb' CODEC(T64, ZSTD(3)) after `low_memory.native_total_heap`
settings mutations_sync = 2;
