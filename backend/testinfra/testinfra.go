package testinfra

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"path/filepath"
	"runtime"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/amacneil/dbmate/v2/pkg/dbmate"
	_ "github.com/amacneil/dbmate/v2/pkg/driver/clickhouse" // blank import: triggers init() to register clickhouse driver with dbmate
	_ "github.com/amacneil/dbmate/v2/pkg/driver/postgres"   // blank import: triggers init() to register postgres driver with dbmate
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leporo/sqlf"
	chmodule "github.com/testcontainers/testcontainers-go/modules/clickhouse" // aliased to avoid conflict with clickhouse-go/v2
	pgmodule "github.com/testcontainers/testcontainers-go/modules/postgres"   // aliased for consistency with chmodule
	vkmodule "github.com/testcontainers/testcontainers-go/modules/valkey"
	"github.com/valkey-io/valkey-go"
)

const (
	// Test database credentials.
	postgresImage   = "postgres:16.3-alpine"
	clickhouseImage = "clickhouse/clickhouse-server:25.8-alpine"
	valkeyImage     = "valkey/valkey:8-alpine"
	testDBUser      = "test"
	testDBPassword  = "test"
	testDBName      = "measure"
)

// repoRoot returns the absolute path to the repository root.
// This file lives at backend/testinfra/testinfra.go, so the
// repo root is two directories up.
func repoRoot() string {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		log.Fatal("unable to determine repo root via runtime.Caller")
	}
	return filepath.Join(filepath.Dir(filename), "..", "..")
}

// runMigrations runs all dbmate migrations from the given directory
// against the database at the given URL.
func runMigrations(rawURL string, migDir string) {
	u, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("failed to parse migration URL: %v", err)
	}

	db := dbmate.New(u)
	db.AutoDumpSchema = false
	db.MigrationsDir = []string{migDir}

	if err := db.Migrate(); err != nil {
		log.Fatalf("failed to run migrations from %s: %v", migDir, err)
	}
}

// SetupPostgres starts a Postgres container, creates the measure schema,
// runs all migrations from self-host/postgres/, and returns a *pgxpool.Pool
// plus a cleanup function.
func SetupPostgres(ctx context.Context) (*pgxpool.Pool, func()) {
	container, err := pgmodule.Run(ctx,
		postgresImage,
		pgmodule.WithDatabase(testDBName),
		pgmodule.WithUsername(testDBUser),
		pgmodule.WithPassword(testDBPassword),
		pgmodule.WithSQLDriver("pgx"),
		pgmodule.BasicWaitStrategies(),
	)
	if err != nil {
		log.Fatalf("failed to start postgres container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		log.Fatalf("failed to get postgres connection string: %v", err)
	}

	poolConfig, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		log.Fatalf("failed to parse postgres config: %v", err)
	}
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	poolConfig.ConnConfig.RuntimeParams["search_path"] = "measure"

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("failed to create postgres pool: %v", err)
	}

	// Create the measure schema used by all tables.
	if _, err := pool.Exec(ctx, "CREATE SCHEMA IF NOT EXISTS measure"); err != nil {
		log.Fatalf("failed to create measure schema: %v", err)
	}

	// Run all Postgres migrations using dbmate.
	// search_path includes both dbmate (for schema_migrations) and measure.
	migDir := filepath.Join(repoRoot(), "self-host", "postgres")
	pgURL, err := url.Parse(connStr)
	if err != nil {
		log.Fatalf("failed to parse postgres URL for migrations: %v", err)
	}
	q := pgURL.Query()
	q.Set("search_path", "dbmate,measure")
	q.Set("sslmode", "disable")
	pgURL.RawQuery = q.Encode()
	runMigrations(pgURL.String(), migDir)

	sqlf.SetDialect(sqlf.PostgreSQL)

	cleanup := func() {
		pool.Close()
		container.Terminate(context.Background())
	}

	return pool, cleanup
}

// SetupClickHouse starts a ClickHouse container, creates the measure
// database, runs all migrations from self-host/clickhouse/, and returns
// a driver.Conn plus a cleanup function.
func SetupClickHouse(ctx context.Context) (driver.Conn, func()) {
	container, err := chmodule.Run(ctx,
		clickhouseImage,
		chmodule.WithDatabase(testDBName),
		chmodule.WithUsername(testDBUser),
		chmodule.WithPassword(testDBPassword),
	)
	if err != nil {
		log.Fatalf("failed to start clickhouse container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		log.Fatalf("failed to get clickhouse connection string: %v", err)
	}

	// Run all ClickHouse migrations using dbmate.
	migDir := filepath.Join(repoRoot(), "self-host", "clickhouse")
	runMigrations(connStr, migDir)

	opts, err := clickhouse.ParseDSN(connStr)
	if err != nil {
		log.Fatalf("failed to parse clickhouse DSN: %v", err)
	}

	conn, err := clickhouse.Open(opts)
	if err != nil {
		log.Fatalf("failed to open clickhouse connection: %v", err)
	}

	if err := conn.Ping(ctx); err != nil {
		log.Fatalf("failed to ping clickhouse: %v", err)
	}

	// self-host/migrations/v0.10.x-read-optim.sh modifies the schemas of
	// events, unhandled_exception_groups, and anr_groups outside of dbmate
	// (it uses CREATE OR REPLACE TABLE + EXCHANGE TABLES to switch engines
	// and restructure columns). Because dbmate never sees those changes, the
	// test containers end up with the old schemas. We replicate the relevant
	// DDL from that script here so that tests run against the correct table
	// structure.
	schemaFixes := []string{
		`create or replace table measure.events
(
    "id" UUID comment 'unique event id' CODEC(LZ4),
    "team_id" LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    "app_id" LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    "session_id" UUID comment 'associated session id' CODEC(LZ4),
    "timestamp" DateTime64(3, 'UTC') comment 'event timestamp' CODEC(DoubleDelta, ZSTD(3)),
    "inserted_at" DateTime64(3, 'UTC') DEFAULT now64() comment 'original event insertion timestamp' CODEC(Delta(8), ZSTD(3)),
    "type" LowCardinality(String) comment 'type of the event' CODEC(ZSTD(3)),
    "user_triggered" Bool comment 'true if user chose to trigger by themselves' CODEC(ZSTD(3)),
    "inet.ipv4" Nullable(IPv4) comment 'ipv4 address' CODEC(ZSTD(3)),
    "inet.ipv6" Nullable(IPv6) comment 'ipv6 address' CODEC(ZSTD(3)),
    "inet.country_code" LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    "attribute.installation_id" UUID comment 'unique id for an installation of an app, generated by sdk' CODEC(LZ4),
    "attribute.app_version" LowCardinality(String) comment 'app version identifier' CODEC(ZSTD(3)),
    "attribute.app_build" LowCardinality(String) comment 'app build identifier' CODEC(ZSTD(3)),
    "attribute.app_unique_id" LowCardinality(String) comment 'app bundle identifier' CODEC(ZSTD(3)),
    "attribute.platform" LowCardinality(String) comment 'platform identifier' CODEC(ZSTD(3)),
    "attribute.measure_sdk_version" String comment 'measure sdk version identifier' CODEC(ZSTD(3)),
    "attribute.thread_name" String comment 'thread on which the event was captured' CODEC(ZSTD(3)),
    "attribute.user_id" String comment 'id of the app''s end user' CODEC(ZSTD(3)),
    "attribute.device_name" String comment 'name of the device' CODEC(ZSTD(3)),
    "attribute.device_model" String comment 'model of the device' CODEC(ZSTD(3)),
    "attribute.device_manufacturer" String comment 'manufacturer of the device' CODEC(ZSTD(3)),
    "attribute.device_type" LowCardinality(String) comment 'type of the device, like phone or tablet' CODEC(ZSTD(3)),
    "attribute.device_is_foldable" Bool comment 'true for foldable devices' CODEC(ZSTD(3)),
    "attribute.device_is_physical" Bool comment 'true for physical devices' CODEC(ZSTD(3)),
    "attribute.device_density_dpi" UInt16 comment 'dpi density' CODEC(Delta(2), ZSTD(3)),
    "attribute.device_width_px" UInt16 comment 'screen width' CODEC(Delta(2), ZSTD(3)),
    "attribute.device_height_px" UInt16 comment 'screen height' CODEC(Delta(2), ZSTD(3)),
    "attribute.device_density" Float32 comment 'device density' CODEC(Delta(4), ZSTD(3)),
    "attribute.device_locale" LowCardinality(String) comment 'rfc 5646 locale string' CODEC(ZSTD(3)),
    "attribute.device_low_power_mode" Bool comment 'true if low power mode is enabled',
    "attribute.device_thermal_throttling_enabled" Bool comment 'true if thermal throttling is enabled',
    "attribute.device_cpu_arch" LowCardinality(String) comment 'cpu architecture like arm64 and so on',
    "attribute.os_name" LowCardinality(String) comment 'name of the operating system' CODEC(ZSTD(3)),
    "attribute.os_version" String comment 'version of the operating system' CODEC(ZSTD(3)),
    "attribute.os_page_size" UInt8 comment 'memory_page_size' CODEC(Delta(1), ZSTD(3)),
    "attribute.network_type" LowCardinality(String) comment 'either - wifi, cellular, vpn, unknown, no_network' CODEC(ZSTD(3)),
    "attribute.network_generation" LowCardinality(String) comment 'either - 2g, 3g, 4g, 5g, unknown' CODEC(ZSTD(3)),
    "attribute.network_provider" String comment 'name of the network service provider' CODEC(ZSTD(3)),
    "user_defined_attribute" Map(LowCardinality(String), Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)) comment 'user defined attributes' CODEC(ZSTD(3)),
    "anr.handled" Bool comment 'anr was handled by the application code' CODEC(ZSTD(3)),
    "anr.fingerprint" String comment 'fingerprint for anr similarity classification' CODEC(ZSTD(3)),
    "anr.exceptions" String comment 'anr exception data' CODEC(ZSTD(3)),
    "anr.threads" String comment 'anr thread data' CODEC(ZSTD(3)),
    "anr.foreground" Bool comment 'true if the anr was perceived by end user' CODEC(ZSTD(3)),
    "exception.handled" Bool comment 'exception was handled by application code' CODEC(ZSTD(3)),
    "exception.fingerprint" String comment 'fingerprint for exception similarity classification' CODEC(ZSTD(3)),
    "exception.exceptions" String comment 'exception data' CODEC(ZSTD(3)),
    "exception.threads" String comment 'exception thread data' CODEC(ZSTD(3)),
    "exception.foreground" Bool comment 'true if the exception was perceived by end user' CODEC(ZSTD(3)),
    "exception.framework" String comment 'the framework in which the exception was thrown',
    "exception.binary_images" String comment 'list of apple crash binary images',
    "exception.error" String comment 'general error data',
    "app_exit.reason" LowCardinality(String) comment 'reason for app exit' CODEC(ZSTD(3)),
    "app_exit.importance" LowCardinality(String) comment 'importance of process that it used to have before death' CODEC(ZSTD(3)),
    "app_exit.trace" String comment 'modified trace given by ApplicationExitInfo to help debug anrs.' CODEC(ZSTD(3)),
    "app_exit.process_name" String comment 'name of the process that died' CODEC(ZSTD(3)),
    "app_exit.pid" String comment 'id of the process that died' CODEC(ZSTD(3)),
    "string.severity_text" LowCardinality(String) comment 'log level - info, warning, error, fatal, debug' CODEC(ZSTD(3)),
    "string.string" String comment 'log message text' CODEC(ZSTD(3)),
    "gesture_long_click.target" String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
    "gesture_long_click.target_id" String comment 'unique identifier of the target' CODEC(ZSTD(3)),
    "gesture_long_click.touch_down_time" UInt64 comment 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    "gesture_long_click.touch_up_time" UInt64 comment 'time for touch up gesture' CODEC(T64, ZSTD(3)),
    "gesture_long_click.width" UInt16 comment 'width of the target view in pixels' CODEC(T64, ZSTD(3)),
    "gesture_long_click.height" UInt16 comment 'height of the target view in pixels' CODEC(T64, ZSTD(3)),
    "gesture_long_click.x" Float32 comment 'x coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    "gesture_long_click.y" Float32 comment 'y coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    "gesture_click.target" String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
    "gesture_click.target_id" String comment 'unique identifier of the target' CODEC(ZSTD(3)),
    "gesture_click.touch_down_time" UInt64 comment 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    "gesture_click.touch_up_time" UInt64 comment 'time for the touch up gesture' CODEC(T64, ZSTD(3)),
    "gesture_click.width" UInt16 comment 'width of the target view in pixels' CODEC(Delta(2), ZSTD(3)),
    "gesture_click.height" UInt16 comment 'height of the target view in pixels' CODEC(Delta(2), ZSTD(3)),
    "gesture_click.x" Float32 comment 'x coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    "gesture_click.y" Float32 comment 'y coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    "gesture_scroll.target" String comment 'class or instance name of the originating view' CODEC(ZSTD(3)),
    "gesture_scroll.target_id" String comment 'unique identifier of the target' CODEC(ZSTD(3)),
    "gesture_scroll.touch_down_time" UInt64 comment 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    "gesture_scroll.touch_up_time" UInt64 comment 'time for touch up gesture' CODEC(T64, ZSTD(3)),
    "gesture_scroll.x" Float32 comment 'x coordinate of where the gesture started' CODEC(Delta(4), ZSTD(3)),
    "gesture_scroll.y" Float32 comment 'y coordinate of where the gesture started' CODEC(Delta(4), ZSTD(3)),
    "gesture_scroll.end_x" Float32 comment 'x coordinate of where the gesture ended' CODEC(Delta(4), ZSTD(3)),
    "gesture_scroll.end_y" Float32 comment 'y coordinate of where the gesture ended' CODEC(Delta(4), ZSTD(3)),
    "gesture_scroll.direction" LowCardinality(String) comment 'direction of the scroll' CODEC(ZSTD(3)),
    "lifecycle_activity.type" LowCardinality(String) comment 'type of the lifecycle activity' CODEC(ZSTD(3)),
    "lifecycle_activity.class_name" String comment 'fully qualified class name of the activity' CODEC(ZSTD(3)),
    "lifecycle_activity.intent" String comment 'intent data serialized as string' CODEC(ZSTD(3)),
    "lifecycle_activity.saved_instance_state" Bool comment 'represents that activity was recreated with a saved state' CODEC(ZSTD(3)),
    "lifecycle_fragment.type" LowCardinality(String) comment 'type of the lifecycle fragment' CODEC(ZSTD(3)),
    "lifecycle_fragment.class_name" String comment 'fully qualified class name of the fragment' CODEC(ZSTD(3)),
    "lifecycle_fragment.parent_activity" String comment 'fully qualified class name of the parent activity' CODEC(ZSTD(3)),
    "lifecycle_fragment.parent_fragment" String comment 'fully qualified class name of the parent fragment' CODEC(ZSTD(3)),
    "lifecycle_fragment.tag" String comment 'optional fragment tag' CODEC(ZSTD(3)),
    "lifecycle_view_controller.type" LowCardinality(String) comment 'type of the iOS ViewController lifecycle event',
    "lifecycle_view_controller.class_name" LowCardinality(String) comment 'class name of the iOS ViewController lifecycle event',
    "lifecycle_swift_ui.type" LowCardinality(String) comment 'type of the iOS SwiftUI view lifecycle event',
    "lifecycle_swift_ui.class_name" LowCardinality(String) comment 'class name of the iOS SwiftUI view lifecycle event',
    "lifecycle_app.type" LowCardinality(String) comment 'type of the lifecycle app' CODEC(ZSTD(3)),
    "cold_launch.process_start_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "cold_launch.process_start_requested_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "cold_launch.content_provider_attach_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "cold_launch.on_next_draw_uptime" UInt64 comment 'time at which app became visible' CODEC(T64, ZSTD(3)),
    "cold_launch.launched_activity" String comment 'activity which drew the first frame during cold launch' CODEC(ZSTD(3)),
    "cold_launch.has_saved_state" Bool comment 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    "cold_launch.intent_data" String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    "cold_launch.duration" UInt32 comment 'computed cold launch duration' CODEC(T64, ZSTD(3)),
    "warm_launch.app_visible_uptime" UInt64 comment 'time since the app became visible to user, in msec',
    "warm_launch.process_start_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "warm_launch.process_start_requested_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "warm_launch.content_provider_attach_uptime" UInt64 comment 'start uptime in msec' CODEC(T64, ZSTD(3)),
    "warm_launch.on_next_draw_uptime" UInt64 comment 'time at which app became visible to user, in msec' CODEC(ZSTD(3)),
    "warm_launch.launched_activity" String comment 'activity which drew the first frame during warm launch' CODEC(ZSTD(3)),
    "warm_launch.has_saved_state" Bool comment 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    "warm_launch.intent_data" String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    "warm_launch.duration" UInt32 comment 'computed warm launch duration' CODEC(T64, ZSTD(3)),
    "warm_launch.is_lukewarm" Bool comment 'whether it is a lukewarm launch' CODEC(ZSTD(3)),
    "hot_launch.app_visible_uptime" UInt64 comment 'time elapsed since the app became visible to user, in msec' CODEC(T64, ZSTD(3)),
    "hot_launch.on_next_draw_uptime" UInt64 comment 'time at which app became visible to user, in msec' CODEC(T64, ZSTD(3)),
    "hot_launch.launched_activity" String comment 'activity which drew the first frame during hot launch' CODEC(ZSTD(3)),
    "hot_launch.has_saved_state" Bool comment 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    "hot_launch.intent_data" String comment 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    "hot_launch.duration" UInt32 comment 'computed hot launch duration' CODEC(T64, ZSTD(3)),
    "network_change.network_type" LowCardinality(String) comment 'type of the network' CODEC(ZSTD(3)),
    "network_change.previous_network_type" LowCardinality(String) comment 'type of the previous network' CODEC(ZSTD(3)),
    "network_change.network_generation" LowCardinality(String) comment '2g, 3g, 4g etc' CODEC(ZSTD(3)),
    "network_change.previous_network_generation" LowCardinality(String) comment 'previous network generation' CODEC(ZSTD(3)),
    "network_change.network_provider" String comment 'name of the network service provider' CODEC(ZSTD(3)),
    "http.url" String comment 'url of the http request' CODEC(ZSTD(3)),
    "http.method" LowCardinality(String) comment 'method like get, post' CODEC(ZSTD(3)),
    "http.status_code" UInt16 comment 'http status code' CODEC(T64, ZSTD(3)),
    "http.start_time" UInt64 comment 'uptime at when the http call started, in msec' CODEC(T64, ZSTD(3)),
    "http.end_time" UInt64 comment 'uptime at when the http call ended, in msec' CODEC(T64, ZSTD(3)),
    "http_request_headers" Map(String, String) comment 'http request headers' CODEC(ZSTD(3)),
    "http_response_headers" Map(String, String) comment 'http response headers' CODEC(ZSTD(3)),
    "http.request_body" String comment 'request body' CODEC(ZSTD(3)),
    "http.response_body" String comment 'response body' CODEC(ZSTD(3)),
    "http.failure_reason" String comment 'reason for failure' CODEC(ZSTD(3)),
    "http.failure_description" String comment 'description of the failure' CODEC(ZSTD(3)),
    "http.client" LowCardinality(String) comment 'name of the http client' CODEC(ZSTD(3)),
    "memory_usage.java_max_heap" UInt64 comment 'maximum size of the java heap allocated, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.java_total_heap" UInt64 comment 'total size of the java heap available for allocation, in KB' CODEC(T64, ZSTD(3)),
    "memory_usage.java_free_heap" UInt64 comment 'free memory available in the java heap, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.total_pss" UInt64 comment 'total proportional set size, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.rss" UInt64 comment 'resident set size, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.native_total_heap" UInt64 comment 'total size of the native heap, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.native_free_heap" UInt64 comment 'amount of free memory in the native heap, in kb' CODEC(T64, ZSTD(3)),
    "memory_usage.interval" UInt64 comment 'interval between two consecutive readings, in msec' CODEC(T64, ZSTD(3)),
    "memory_usage_absolute.max_memory" UInt64 comment 'maximum memory available to the application, in KiB',
    "memory_usage_absolute.used_memory" UInt64 comment 'used memory by the application, in KiB',
    "memory_usage_absolute.interval" UInt64 comment 'interval between two consecutive readings',
    "low_memory.java_max_heap" UInt64 comment 'maximum size of the java heap allocated, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.java_total_heap" UInt64 comment 'total size of the java heap available for allocation, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.java_free_heap" UInt64 comment 'free memory available in the java heap, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.total_pss" UInt64 comment 'total proportional set size, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.rss" UInt64 comment 'resident set size, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.native_total_heap" UInt64 comment 'total size of the native heap, in kb' CODEC(T64, ZSTD(3)),
    "low_memory.native_free_heap" UInt64 comment 'amount of free memory in the native heap, in kb' CODEC(T64, ZSTD(3)),
    "trim_memory.level" LowCardinality(String) comment 'one of the trim memory constants' CODEC(ZSTD(3)),
    "cpu_usage.num_cores" UInt8 comment 'number of cores on the device' CODEC(T64, ZSTD(3)),
    "cpu_usage.clock_speed" UInt64 comment 'clock speed of the processor, in hz' CODEC(T64, ZSTD(3)),
    "cpu_usage.start_time" UInt64 comment 'process start time, in jiffies' CODEC(T64, ZSTD(3)),
    "cpu_usage.uptime" UInt64 comment 'time since the device booted, in msec' CODEC(T64, ZSTD(3)),
    "cpu_usage.utime" UInt64 comment 'execution time in user mode, in jiffies' CODEC(T64, ZSTD(3)),
    "cpu_usage.cutime" UInt64 comment 'execution time in user mode with child processes, in jiffies' CODEC(T64, ZSTD(3)),
    "cpu_usage.stime" UInt64 comment 'execution time in kernel mode, in jiffies' CODEC(T64, ZSTD(3)),
    "cpu_usage.cstime" UInt64 comment 'execution time in kernel mode with child processes, in jiffies' CODEC(T64, ZSTD(3)),
    "cpu_usage.interval" UInt64 comment 'interval between two consecutive readings, in msec' CODEC(T64, ZSTD(3)),
    "cpu_usage.percentage_usage" Float64 comment 'percentage of cpu usage in the interval' CODEC(DoubleDelta, ZSTD(3)),
    "navigation.to" String comment 'destination page or screen where the navigation led to' CODEC(ZSTD(3)),
    "navigation.from" String comment 'source page or screen from where the navigation was triggered' CODEC(ZSTD(3)),
    "navigation.source" String comment 'how the event was collected' CODEC(ZSTD(3)),
    "screen_view.name" String comment 'name of the screen viewed' CODEC(ZSTD(3)),
    "bug_report.description" String comment 'description of the bug report',
    "custom.name" LowCardinality(String) comment 'name of the custom event',
    "attachments" String comment 'attachment metadata' CODEC(ZSTD(3)),
    index type_set_idx type type set(100) granularity 2,
    index exception_handled_idx "exception.handled" type minmax granularity 2,
    index attribute_os_name_set_idx "attribute.os_name" type set(100) granularity 2,
    index attribute_os_version_set_idx "attribute.os_version" type set(500) granularity 2,
    index inet_country_code_set_idx "inet.country_code" type set(500) granularity 2,
    index attribute_device_name_bloom_idx "attribute.device_name" type bloom_filter(0.25) granularity 2,
    index attribute_device_manufacturer_set_idx "attribute.device_manufacturer" type set(2000) granularity 2,
    index attribute_device_locale_set_idx "attribute.device_locale" type set(3000) granularity 2,
    index attribute_network_provider_set_idx "attribute.network_provider" type set(5000) granularity 2,
    index attribute_network_type_set_idx "attribute.network_type" type set(100) granularity 2,
    index exception_fingerprint_bloom_idx "exception.fingerprint" type bloom_filter(0.025) granularity 4,
    index anr_fingerprint_bloom_idx "anr.fingerprint" type bloom_filter(0.025) granularity 4,
    index user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 8,
    index custom_name_bloom_idx "custom.name" type bloom_filter(0.025) granularity 2,
    index timestamp_minmax_idx "timestamp" type minmax granularity 1
)
engine = ReplacingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, "attribute.app_version", "attribute.app_build", timestamp, session_id, id)
settings index_granularity = 8192
comment 'events root table'`,
		`create or replace table measure.unhandled_exception_groups
(
  ` + "`team_id`" + ` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  ` + "`app_id`" + ` LowCardinality(UUID) comment 'linked app id' CODEC(LZ4),
  ` + "`id`" + ` FixedString(32) comment 'unique fingerprint of the unhandled exception which acts as the id of the group' CODEC(ZSTD(3)),
  ` + "`app_version`" + ` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  ` + "`type`" + ` String comment 'type of the exception' CODEC(ZSTD(3)),
  ` + "`message`" + ` String comment 'message of the exception' CODEC(ZSTD(3)),
  ` + "`method_name`" + ` String comment 'method name where the exception occurred' CODEC(ZSTD(3)),
  ` + "`file_name`" + ` String comment 'file name where the exception occurred' CODEC(ZSTD(3)),
  ` + "`line_number`" + ` Int32 comment 'line number where the exception occurred' CODEC(ZSTD(3)),
  ` + "`os_versions`" + ` AggregateFunction(groupUniqArray, Tuple(String, String)) comment 'list of all unique composite os versions' CODEC(ZSTD(3)),
  ` + "`country_codes`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique country codes' CODEC(ZSTD(3)),
  ` + "`network_providers`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network service providers' CODEC(ZSTD(3)),
  ` + "`network_types`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network types' CODEC(ZSTD(3)),
  ` + "`network_generations`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network generations' CODEC(ZSTD(3)),
  ` + "`device_locales`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device locales' CODEC(ZSTD(3)),
  ` + "`device_manufacturers`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device manufacturers' CODEC(ZSTD(3)),
  ` + "`device_names`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device names' CODEC(ZSTD(3)),
  ` + "`device_models`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device models' CODEC(ZSTD(3)),
  ` + "`count`" + ` AggregateFunction(sum, UInt64) comment 'count of unhandled exception instances' CODEC(ZSTD(3)),
  ` + "`timestamp`" + ` DateTime64(3, 'UTC') comment 'timestamp of the exception event' CODEC(DoubleDelta, ZSTD(3)),
  index id_bloom_idx id type bloom_filter(0.01) granularity 1,
  index timestamp_minmax_idx timestamp type minmax granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version.1, app_version.2, id)
settings index_granularity = 8192
comment 'unhandled exception groups'`,

		`create or replace table measure.anr_groups
(
  ` + "`team_id`" + ` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  ` + "`app_id`" + ` LowCardinality(UUID) comment 'linked app id' CODEC(LZ4),
  ` + "`id`" + ` FixedString(32) comment 'unique fingerprint of the ANR which acts as the id of the group' CODEC(ZSTD(3)),
  ` + "`app_version`" + ` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  ` + "`type`" + ` String comment 'type of the ANR' CODEC(ZSTD(3)),
  ` + "`message`" + ` String comment 'message of the ANR' CODEC(ZSTD(3)),
  ` + "`method_name`" + ` String comment 'method name where the ANR occurred' CODEC(ZSTD(3)),
  ` + "`file_name`" + ` String comment 'file name where the ANR occurred' CODEC(ZSTD(3)),
  ` + "`line_number`" + ` Int32 comment 'line number where the ANR occurred' CODEC(ZSTD(3)),
  ` + "`os_versions`" + ` AggregateFunction(groupUniqArray, Tuple(String, String)) comment 'list of all unique composite os versions' CODEC(ZSTD(3)),
  ` + "`country_codes`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique country codes' CODEC(ZSTD(3)),
  ` + "`network_providers`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network providers' CODEC(ZSTD(3)),
  ` + "`network_types`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network types' CODEC(ZSTD(3)),
  ` + "`network_generations`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique network generations' CODEC(ZSTD(3)),
  ` + "`device_locales`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device locales' CODEC(ZSTD(3)),
  ` + "`device_manufacturers`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device manufacturers' CODEC(ZSTD(3)),
  ` + "`device_names`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device names' CODEC(ZSTD(3)),
  ` + "`device_models`" + ` AggregateFunction(groupUniqArray, String) comment 'list of all unique device models' CODEC(ZSTD(3)),
  ` + "`count`" + ` AggregateFunction(sum, UInt64) comment 'count of ANR instances' CODEC(ZSTD(3)),
  ` + "`timestamp`" + ` DateTime64(3, 'UTC') comment 'timestamp of the ANR event' CODEC(DoubleDelta, ZSTD(3)),
  index id_bloom_idx id type bloom_filter(0.01) granularity 1,
  index timestamp_minmax_idx timestamp type minmax granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version.1, app_version.2, id)
settings index_granularity = 8192
comment 'ANR groups'`,
	}
	for _, ddl := range schemaFixes {
		if err := conn.Exec(ctx, ddl); err != nil {
			log.Fatalf("failed to apply schema fix: %v", err)
		}
	}

	cleanup := func() {
		conn.Close()
		container.Terminate(context.Background())
	}

	return conn, cleanup
}

// SetupValkey starts a Valkey container and returns a valkey.Client
// plus a cleanup function.
func SetupValkey(ctx context.Context) (valkey.Client, func()) {
	container, err := vkmodule.Run(ctx, valkeyImage)
	if err != nil {
		log.Fatalf("failed to start valkey container: %v", err)
	}

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		log.Fatalf("failed to get valkey connection string: %v", err)
	}

	// ConnectionString returns a URI like "redis://host:port".
	// valkey-go expects "host:port".
	u, err := url.Parse(connStr)
	if err != nil {
		log.Fatalf("failed to parse valkey connection string: %v", err)
	}
	addr := fmt.Sprintf("%s:%s", u.Hostname(), u.Port())

	client, err := valkey.NewClient(valkey.ClientOption{
		InitAddress: []string{addr},
	})
	if err != nil {
		log.Fatalf("failed to create valkey client: %v", err)
	}

	cleanup := func() {
		client.Close()
		container.Terminate(context.Background())
	}

	return client, cleanup
}
