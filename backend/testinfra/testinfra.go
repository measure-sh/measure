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
	chmodule "github.com/testcontainers/testcontainers-go/modules/clickhouse" // aliased to avoid conflict with clickhouse-go/v2
	pgmodule "github.com/testcontainers/testcontainers-go/modules/postgres"   // aliased for consistency with chmodule
	vkmodule "github.com/testcontainers/testcontainers-go/modules/valkey"
	"github.com/valkey-io/valkey-go"
)

const (
	// Test database credentials.
	postgresImage   = "postgres:16.3-alpine"
	clickhouseImage = "clickhouse/clickhouse-server:25.10-alpine"
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
	// several tables outside of dbmate (it uses CREATE OR REPLACE TABLE +
	// EXCHANGE TABLES to switch engines and restructure columns). Because
	// dbmate never sees those changes, the test containers end up with old
	// schemas. We replicate the relevant DDL from that script here so that
	// tests run against the correct table structure.
	//
	// NOTE: The production migration uses LowCardinality(String) inside
	// AggregateFunction(groupUniqArray, Tuple(...)) for os_versions and
	// similar columns in exception/anr groups. ClickHouse 25.x silently
	// strips LowCardinality from Tuple types inside AggregateFunction
	// columns, causing a type mismatch when inserting default values.
	// We use plain String/Tuple(String, String) in those columns here;
	// LowCardinality is a compression optimization that doesn't affect
	// query correctness.
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
		`drop table if exists measure.unhandled_exception_groups sync`,
		`create table measure.unhandled_exception_groups
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

		`drop table if exists measure.anr_groups sync`,
		`create table measure.anr_groups
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

		`create or replace table measure.spans
(
    ` + "`team_id`" + ` LowCardinality(UUID) comment 'unique id of the team' CODEC(LZ4),
    ` + "`app_id`" + ` LowCardinality(UUID) comment 'unique id of the app' CODEC(LZ4),
    ` + "`inserted_at`" + ` DateTime64(3, 'UTC') DEFAULT now64() comment 'original event insertion timestamp' CODEC(Delta(8), ZSTD(3)),
    ` + "`span_name`" + ` LowCardinality(String) comment 'name of the span' CODEC(ZSTD(3)),
    ` + "`span_id`" + ` FixedString(16) comment 'id of the span' CODEC(ZSTD(3)),
    ` + "`parent_id`" + ` FixedString(16) comment 'id of the parent span' CODEC(ZSTD(3)),
    ` + "`trace_id`" + ` FixedString(32) comment 'id of the trace' CODEC(ZSTD(3)),
    ` + "`session_id`" + ` UUID comment 'session id' CODEC(LZ4),
    ` + "`status`" + ` UInt8 comment 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' CODEC(ZSTD(3)),
    ` + "`start_time`" + ` DateTime64(3, 'UTC') comment 'start time' CODEC(DoubleDelta, ZSTD(3)),
    ` + "`end_time`" + ` DateTime64(3, 'UTC') comment 'end time' CODEC(DoubleDelta, ZSTD(3)),
    ` + "`checkpoints`" + ` Array(Tuple(String, DateTime64(3, 'UTC'))) comment 'array of checkpoints - {name, timestamp}' CODEC(ZSTD(3)),
    ` + "`attribute.app_unique_id`" + ` LowCardinality(String) comment 'app bundle identifier' CODEC(ZSTD(3)),
    ` + "`attribute.installation_id`" + ` UUID comment 'unique id for an installation of an app, generated by sdk' CODEC(LZ4),
    ` + "`attribute.user_id`" + ` LowCardinality(String) comment 'attributed user id' CODEC(ZSTD(3)),
    ` + "`attribute.measure_sdk_version`" + ` LowCardinality(String) comment 'measure sdk version identifier' CODEC(ZSTD(3)),
    ` + "`attribute.app_version`" + ` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    ` + "`attribute.os_version`" + ` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    ` + "`attribute.platform`" + ` LowCardinality(String) comment 'platform identifier' CODEC(ZSTD(3)),
    ` + "`attribute.thread_name`" + ` String comment 'thread on which the span was captured' CODEC(ZSTD(3)),
    ` + "`attribute.country_code`" + ` LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    ` + "`attribute.network_provider`" + ` LowCardinality(String) comment 'name of the network service provider' CODEC(ZSTD(3)),
    ` + "`attribute.network_type`" + ` LowCardinality(String) comment 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    ` + "`attribute.network_generation`" + ` LowCardinality(String) comment '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    ` + "`attribute.device_name`" + ` LowCardinality(String) comment 'name of the device' CODEC(ZSTD(3)),
    ` + "`attribute.device_model`" + ` LowCardinality(String) comment 'model of the device' CODEC(ZSTD(3)),
    ` + "`attribute.device_manufacturer`" + ` LowCardinality(String) comment 'manufacturer of the device' CODEC(ZSTD(3)),
    ` + "`attribute.device_locale`" + ` LowCardinality(String) comment 'rfc 5646 locale string' CODEC(ZSTD(3)),
    ` + "`attribute.device_low_power_mode`" + ` Bool comment 'true if device is in power saving mode' CODEC(ZSTD(3)),
    ` + "`attribute.device_thermal_throttling_enabled`" + ` Bool comment 'true if device is has thermal throttling enabled' CODEC(ZSTD(3)),
    ` + "`user_defined_attribute`" + ` Map(LowCardinality(String), Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)) comment 'user defined attributes' CODEC(ZSTD(3)),
    index span_name_bloom_idx span_name type bloom_filter(0.025) granularity 2,
    index span_id_bloom_idx span_id type bloom_filter(0.025) granularity 2,
    index trace_id_bloom_idx trace_id type bloom_filter(0.01) granularity 1,
    index session_id_bloom_idx session_id type bloom_filter(0.01) granularity 2,
    index parent_id_bloom_idx parent_id type bloom_filter(0.025) granularity 2,
    index start_time_minmax_idx start_time type minmax granularity 1,
    index end_time_minmax_idx end_time type minmax granularity 1,
    index os_version_set_idx ` + "`attribute.os_version`" + ` type set(100) granularity 2,
    index country_code_set_idx ` + "`attribute.country_code`" + ` type set(1000) granularity 2,
    index network_provider_set_idx ` + "`attribute.network_provider`" + ` type set(5000) granularity 2,
    index network_type_set_idx ` + "`attribute.network_type`" + ` type set(100) granularity 2,
    index network_generation_set_idx ` + "`attribute.network_generation`" + ` type set(100) granularity 2,
    index device_locale_set_idx ` + "`attribute.device_locale`" + ` type set(1000) granularity 2,
    index device_manufacturer_set_idx ` + "`attribute.device_manufacturer`" + ` type set(2000) granularity 2,
    index device_name_set_idx ` + "`attribute.device_name`" + ` type set(2000) granularity 2,
    index user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 8
)
engine = ReplacingMergeTree
partition by toYYYYMM(start_time)
primary key (team_id, app_id, ` + "`attribute.app_version`" + `.1, ` + "`attribute.app_version`" + `.2)
order by (team_id, app_id, ` + "`attribute.app_version`" + `.1, ` + "`attribute.app_version`" + `.2, span_name, start_time, trace_id, span_id)
settings index_granularity = 8192
comment 'spans table'`,

		`create or replace table measure.span_metrics
(
    ` + "`team_id`" + ` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    ` + "`app_id`" + ` LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    ` + "`span_name`" + ` LowCardinality(String) comment 'name of the span' CODEC(ZSTD(3)),
    ` + "`span_id`" + ` FixedString(16) comment 'id of the span' CODEC(ZSTD(3)),
    ` + "`status`" + ` UInt8 comment 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' CODEC(ZSTD(3)),
    ` + "`timestamp`" + ` DateTime64(3, 'UTC') comment 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
    ` + "`app_version`" + ` Tuple(
        LowCardinality(String),
        LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    ` + "`os_version`" + ` Tuple(
        LowCardinality(String),
        LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    ` + "`country_code`" + ` LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    ` + "`network_provider`" + ` LowCardinality(String) comment 'network provider' CODEC(ZSTD(3)),
    ` + "`network_type`" + ` LowCardinality(String) comment 'network type' CODEC(ZSTD(3)),
    ` + "`network_generation`" + ` LowCardinality(String) comment 'network generation' CODEC(ZSTD(3)),
    ` + "`device_locale`" + ` LowCardinality(String) comment 'device locale' CODEC(ZSTD(3)),
    ` + "`device_manufacturer`" + ` LowCardinality(String) comment 'device manufacturer' CODEC(ZSTD(3)),
    ` + "`device_name`" + ` LowCardinality(String) comment 'device name' CODEC(ZSTD(3)),
    ` + "`device_low_power_mode`" + ` Bool comment 'true if device is in power saving mode' CODEC(ZSTD(3)),
    ` + "`device_thermal_throttling_enabled`" + ` Bool comment 'true if device is has thermal throttling enabled' CODEC(ZSTD(3)),
    ` + "`p50`" + ` AggregateFunction(quantile(0.5), Int64) comment 'p50 quantile of span duration' CODEC(ZSTD(3)),
    ` + "`p90`" + ` AggregateFunction(quantile(0.9), Int64) comment 'p90 quantile of span duration' CODEC(ZSTD(3)),
    ` + "`p95`" + ` AggregateFunction(quantile(0.95), Int64) comment 'p95 quantile of span duration' CODEC(ZSTD(3)),
    ` + "`p99`" + ` AggregateFunction(quantile(0.5), Int64) comment 'p99 quantile of span duration' CODEC(ZSTD(3)),
    index status_set_idx status type set(100) granularity 2,
    index os_version_set_idx os_version type set(1000) granularity 2,
    index country_code_set_idx country_code type set(1000) granularity 2,
    index network_provider_set_idx network_provider type set(5000) granularity 2,
    index network_type_set_idx network_type type set(100) granularity 2,
    index network_generation_set_idx network_generation type set(100) granularity 2,
    index device_locale_set_idx device_locale type set(5000) granularity 2,
    index device_manufacturer_set_idx device_manufacturer type set(5000) granularity 2,
    index device_name_set_idx device_name type set(5000) granularity 2
)
engine = AggregatingMergeTree
order by (team_id, app_id, app_version.1, app_version.2, span_name, timestamp, span_id)
settings index_granularity = 8192
comment 'aggregated span metrics by a fixed time window'`,

		// ----- sessions -----
		`drop table if exists measure.sessions_mv sync`,
		`drop table if exists measure.sessions_span_mv sync`,
		`create or replace table measure.sessions
(
  session_id UUID comment 'session id' CODEC(LZ4),
  team_id LowCardinality(UUID) CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'unique id of the app' CODEC(LZ4),
  first_event_timestamp SimpleAggregateFunction(min, DateTime64(3, 'UTC')) comment 'timestamp of the first event' CODEC(DoubleDelta, ZSTD(3)),
  last_event_timestamp SimpleAggregateFunction(max, DateTime64(3, 'UTC')) comment 'timestamp of the last event' CODEC(DoubleDelta, ZSTD(3)),

  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),

  country_codes SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique country codes',
  network_providers SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network service providers',
  network_types SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network types',
  network_generations SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network generations',
  device_locales SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device locales',

  device_manufacturer String comment 'manufacturer of the device' CODEC(ZSTD(3)),
  device_name String comment 'name of the device' CODEC(ZSTD(3)),
  device_model String comment 'model of the device' CODEC(ZSTD(3)),

  user_ids SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all user ids',
  unique_types SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique event type' CODEC(ZSTD(3)),
  unique_custom_type_names SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique custom event type names' CODEC(ZSTD(3)),
  unique_strings SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log string values' CODEC(ZSTD(3)),
  unique_view_classnames SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique view class names' CODEC(ZSTD(3)),
  unique_subview_classnames SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique subview class names' CODEC(ZSTD(3)),

  unique_unhandled_exceptions SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
    type String,
    message String,
    file_name String,
    class_name String,
    method_name String))) comment 'list of unique tuples of unhandled exception details' CODEC(ZSTD(3)),
  unique_handled_exceptions SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
    type String,
    message String,
    file_name String,
    class_name String,
    method_name String))) comment 'list of unique tuples of handled exception details' CODEC(ZSTD(3)),
  unique_errors SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique exception error values' CODEC(ZSTD(3)),
  unique_anrs SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
    type String,
    message String,
    file_name String,
    class_name String,
    method_name String))) comment 'list of unique tuples of anr details' CODEC(ZSTD(3)),
  unique_click_targets SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of click targets and ids' CODEC(ZSTD(3)),
  unique_longclick_targets SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of long click targets and ids' CODEC(ZSTD(3)),
  unique_scroll_targets SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of unique tuples of scroll targets and ids' CODEC(ZSTD(3)),

  event_count SimpleAggregateFunction(sum, UInt64) comment 'count of events in this session' CODEC(ZSTD(3)),
  crash_count SimpleAggregateFunction(sum, UInt64) comment 'count of crash events in this session' CODEC(ZSTD(3)),
  anr_count SimpleAggregateFunction(sum, UInt64) comment 'count of ANR events in this session' CODEC(ZSTD(3)),
  bug_report_count SimpleAggregateFunction(sum, UInt64) comment 'count of bug report events in this session' CODEC(ZSTD(3)),
  background_count SimpleAggregateFunction(sum, UInt64) comment 'count of background events in this session' CODEC(ZSTD(3)),
  foreground_count SimpleAggregateFunction(sum, UInt64) comment 'count of foreground events in this session' CODEC(ZSTD(3)),

  event_type_counts SimpleAggregateFunction(sumMap, Map(String, UInt64)) comment 'count of event types in this session' CODEC(ZSTD(3)),

  index session_id_bloom_idx session_id type bloom_filter(0.01) granularity 1,
  index crash_count_minmax_idx crash_count type minmax granularity 1,
  index anr_count_minmax_idx anr_count type minmax granularity 1,
  index bug_report_count_minmax_idx bug_report_count type minmax granularity 1,
  index background_count_minmax_idx background_count type minmax granularity 1,
  index foreground_count_minmax_idx foreground_count type minmax granularity 1,
  index event_type_counts_bloom_idx mapKeys(event_type_counts) type bloom_filter(0.025) granularity 1,
  index first_event_timestamp_minmax_idx first_event_timestamp type minmax granularity 1,
  index last_event_timestamp_minmax_idx last_event_timestamp type minmax granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(first_event_timestamp)
order by (team_id, app_id, app_version.1, app_version.2, session_id)
settings index_granularity = 8192
comment 'aggregated app sessions'`,

		`create materialized view measure.sessions_mv
to measure.sessions
as
select
  session_id,
  team_id,
  app_id,
  minSimpleState(timestamp) as first_event_timestamp,
  maxSimpleState(timestamp) as last_event_timestamp,
  (attribute.app_version, attribute.app_build) as app_version,
  (attribute.os_name, attribute.os_version) as os_version,
  groupUniqArrayArraySimpleState(if(inet.country_code != '', [inet.country_code], [])) as country_codes,
  groupUniqArrayArraySimpleState(if(attribute.network_provider != '', [attribute.network_provider], [])) as network_providers,
  groupUniqArrayArraySimpleState(if(attribute.network_type != '', [attribute.network_type], [])) as network_types,
  groupUniqArrayArraySimpleState(if(attribute.network_generation != '', [attribute.network_generation], [])) as network_generations,
  groupUniqArrayArraySimpleState([attribute.device_locale]) as device_locales,
  argMax(attribute.device_name, timestamp) as device_name,
  argMax(attribute.device_manufacturer, timestamp) as device_manufacturer,
  argMax(attribute.device_model, timestamp) as device_model,
  groupUniqArrayArraySimpleState(if(attribute.user_id != '', [attribute.user_id], [])) as user_ids,
  groupUniqArrayArraySimpleState([type]) as unique_types,
  groupUniqArrayArraySimpleState(if(type = 'custom', [custom.name], [])) as unique_custom_type_names,
  groupUniqArrayArraySimpleState(if(string.string != '', [string.string], [])) as unique_strings,
  groupUniqArrayArraySimpleState(if(type = 'lifecycle_activity' and lifecycle_activity.class_name != '', [lifecycle_activity.class_name], [])) as unique_view_classnames,
  groupUniqArrayArraySimpleState(if(type = 'lifecycle_fragment' and lifecycle_fragment.class_name != '', [lifecycle_fragment.class_name], [])) as unique_subview_classnames,
  groupUniqArrayArraySimpleState(if(type = 'exception' and exception.handled = 0, [tuple(simpleJSONExtractString(exception.exceptions, 'type'), simpleJSONExtractString(exception.exceptions, 'message'), simpleJSONExtractString(exception.exceptions, 'file_name'), simpleJSONExtractString(exception.exceptions, 'class_name'), simpleJSONExtractString(exception.exceptions, 'method_name'))], [])) as unique_unhandled_exceptions,
  groupUniqArrayArraySimpleState(if(type = 'exception' and exception.handled = 1, [tuple(simpleJSONExtractString(exception.exceptions, 'type'), simpleJSONExtractString(exception.exceptions, 'message'), simpleJSONExtractString(exception.exceptions, 'file_name'), simpleJSONExtractString(exception.exceptions, 'class_name'), simpleJSONExtractString(exception.exceptions, 'method_name'))], [])) as unique_handled_exceptions,
  groupUniqArrayArraySimpleState(if(type = 'exception' and exception.error != '' and exception.error != '{}', [exception.error], [])) as unique_errors,
  groupUniqArrayArraySimpleState(if(type = 'anr', [tuple(simpleJSONExtractString(anr.exceptions, 'type'), simpleJSONExtractString(anr.exceptions, 'message'), simpleJSONExtractString(anr.exceptions, 'file_name'), simpleJSONExtractString(anr.exceptions, 'class_name'), simpleJSONExtractString(anr.exceptions, 'method_name'))], [])) as unique_anrs,
  groupUniqArrayArraySimpleState(if(type = 'gesture_click', [tuple(gesture_click.target, gesture_click.target_id)], [])) as unique_click_targets,
  groupUniqArrayArraySimpleState(if(type = 'gesture_long_click', [tuple(gesture_long_click.target, gesture_long_click.target_id)], [])) as unique_longclick_targets,
  groupUniqArrayArraySimpleState(if(type = 'gesture_scroll', [tuple(gesture_scroll.target, gesture_scroll.target_id)], [])) as unique_scroll_targets,
  sumSimpleState(toUInt64(1)) as event_count,
  sumSimpleState(if(type = 'exception' and exception.handled = 0, toUInt64(1), toUInt64(0))) as crash_count,
  sumSimpleState(if(type = 'anr', toUInt64(1), toUInt64(0))) as anr_count,
  sumSimpleState(if(type = 'bug_report', toUInt64(1), toUInt64(0))) as bug_report_count,
  sumSimpleState(if(type = 'lifecycle_app' and lifecycle_app.type = 'background', toUInt64(1), toUInt64(0))) as background_count,
  sumSimpleState(if(type = 'lifecycle_app' and lifecycle_app.type = 'foreground', toUInt64(1), toUInt64(0))) as foreground_count,
  sumMapSimpleState(map(type, toUInt64(1))) as event_type_counts
from measure.events
group by team_id, app_id, session_id, app_version, os_version`,

		`create materialized view measure.sessions_span_mv to measure.sessions
as select
  session_id,
  team_id,
  app_id,
  minSimpleState(start_time) as first_event_timestamp,
  maxSimpleState(end_time) as last_event_timestamp,
  argMax(attribute.app_version, start_time) as app_version,
  argMax(attribute.os_version, start_time) as os_version,
  groupUniqArrayArraySimpleState([attribute.country_code]) as country_codes,
  groupUniqArrayArraySimpleState([attribute.network_provider]) as network_providers,
  groupUniqArrayArraySimpleState([attribute.network_type]) as network_types,
  groupUniqArrayArraySimpleState([attribute.network_generation]) as network_generations,
  groupUniqArrayArraySimpleState([attribute.device_locale]) as device_locales,
  argMax(attribute.device_manufacturer, start_time) as device_manufacturer,
  argMax(attribute.device_name, start_time) as device_name,
  argMax(attribute.device_model, start_time) as device_model,
  groupUniqArrayArraySimpleState([attribute.user_id]) as user_ids,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_types,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_custom_type_names,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_strings,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_view_classnames,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_subview_classnames,
  groupUniqArrayArraySimpleState([]::Array(Tuple(String, String, String, String, String))) as unique_unhandled_exceptions,
  groupUniqArrayArraySimpleState([]::Array(Tuple(String, String, String, String, String))) as unique_handled_exceptions,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_errors,
  groupUniqArrayArraySimpleState([]::Array(Tuple(String, String, String, String, String))) as unique_anrs,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_click_targets,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_longclick_targets,
  groupUniqArrayArraySimpleState([]::Array(String)) as unique_scroll_targets,
  sumSimpleState(toUInt64(0)) as event_count,
  sumSimpleState(toUInt64(0)) as crash_count,
  sumSimpleState(toUInt64(0)) as anr_count,
  sumSimpleState(toUInt64(0)) as bug_report_count,
  sumSimpleState(toUInt64(0)) as background_count,
  sumSimpleState(toUInt64(0)) as foreground_count,
  sumMapSimpleState(map()::Map(String, UInt64)) as event_type_counts
from measure.spans
group by team_id, app_id, attribute.app_version, session_id`,

		// ----- bug_reports -----
		`drop table if exists measure.bug_reports_mv sync`,
		`create or replace table measure.bug_reports
(
  team_id LowCardinality(UUID) CODEC(LZ4),
  event_id UUID comment 'bug report event id' CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'unique id of the app' CODEC(LZ4),
  session_id UUID comment 'session id' CODEC(LZ4),
  timestamp DateTime64(3, 'UTC') comment 'timestamp of the bug report' CODEC(DoubleDelta, ZSTD(3)),
  updated_at DateTime64(3, 'UTC') comment 'timestamp when record was last updated' CODEC(DoubleDelta, ZSTD(3)),
  status UInt8 comment 'status of the bug report 0 (Closed) or 1 (Open)' CODEC(ZSTD(3)),
  description String comment 'description of the bug report' CODEC(ZSTD(3)),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
  country_code LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
  network_provider LowCardinality(String) comment 'name of the network service provider' CODEC(ZSTD(3)),
  network_type LowCardinality(String) comment 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
  network_generation LowCardinality(String) comment '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
  device_locale LowCardinality(String) comment 'rfc 5646 locale string' CODEC(ZSTD(3)),
  device_manufacturer LowCardinality(String) comment 'manufacturer of the device' CODEC(ZSTD(3)),
  device_name LowCardinality(String) comment 'name of the device' CODEC(ZSTD(3)),
  device_model LowCardinality(String) comment 'model of the device' CODEC(ZSTD(3)),
  user_id LowCardinality(String) comment 'attributed user id' CODEC(ZSTD(3)),
  device_low_power_mode Bool comment 'true if low power mode is enabled',
  device_thermal_throttling_enabled Bool comment 'true if thermal throttling is enabled',
  user_defined_attribute Map(LowCardinality(String), Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)) comment 'user defined attributes' CODEC(ZSTD(3)),
  attachments String comment 'attachment metadata',

  index event_id_bloom_idx event_id type bloom_filter(0.01) granularity 2,
  index session_id_bloom_idx session_id type bloom_filter(0.01) granularity 2,
  index status_set_idx status type set(100) granularity 2,
  index os_version_set_idx os_version type set(100) granularity 2,
  index country_code_set_idx country_code type set(100) granularity 2,
  index network_provider_set_idx network_provider type set(100) granularity 2,
  index network_type_set_idx network_type type set(100) granularity 2,
  index network_generation_set_idx network_generation type set(100) granularity 2,
  index device_locale_set_idx device_locale type set(100) granularity 2,
  index device_manufacturer_set_idx device_manufacturer type set(100) granularity 2,
  index device_name_set_idx device_name type set(100) granularity 2,
  index user_id_bloom_idx user_id type bloom_filter(0.01) granularity 2,
  index user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 8
)
engine = ReplacingMergeTree()
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version.1, app_version.2, timestamp, event_id)
settings
  index_granularity = 1024,
  enable_block_number_column = 1,
  enable_block_offset_column = 1
comment 'derived bug reports'`,

		`create materialized view measure.bug_reports_mv to measure.bug_reports
(
  team_id UUID,
  event_id UUID,
  app_id UUID,
  session_id UUID,
  timestamp DateTime64(3, 'UTC'),
  updated_at DateTime64(3, 'UTC'),
  status UInt8,
  description String,
  app_version Tuple(String, String),
  os_version Tuple(String, String),
  country_code String,
  network_provider String,
  network_type String,
  network_generation String,
  device_locale String,
  device_manufacturer String,
  device_name String,
  device_model String,
  user_id String,
  device_low_power_mode Bool,
  device_thermal_throttling_enabled Bool,
  user_defined_attribute Map(String, Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)),
  attachments String
)
as select
  team_id,
  id AS event_id,
  app_id,
  session_id,
  temp_timestamp AS timestamp,
  temp_timestamp AS updated_at,
  0 AS status,
  description,
  app_version,
  os_version,
  country_code,
  network_provider,
  network_type,
  network_generation,
  device_locale,
  device_manufacturer,
  device_name,
  device_model,
  user_id,
  device_low_power_mode,
  device_thermal_throttling_enabled,
  user_defined_attribute,
  attachments
from (
  select
    team_id,
    id,
    app_id,
    session_id,
    any(timestamp) AS temp_timestamp,
    any(bug_report.description) AS description,
    any((attribute.app_version, attribute.app_build)) AS app_version,
    any((attribute.os_name, attribute.os_version)) AS os_version,
    any(inet.country_code) AS country_code,
    any(attribute.network_provider) AS network_provider,
    any(attribute.network_type) AS network_type,
    any(attribute.network_generation) AS network_generation,
    any(attribute.device_locale) AS device_locale,
    any(attribute.device_manufacturer) AS device_manufacturer,
    any(attribute.device_name) AS device_name,
    any(attribute.device_model) AS device_model,
    any(attribute.user_id) AS user_id,
    any(attribute.device_low_power_mode) AS device_low_power_mode,
    any(attribute.device_thermal_throttling_enabled) AS device_thermal_throttling_enabled,
    any(user_defined_attribute) AS user_defined_attribute,
    any(attachments) AS attachments
  from measure.events
  where type = 'bug_report'
  group by team_id, app_id, session_id, id
)`,

		// ----- app_filters -----
		`drop table if exists measure.app_filters_mv sync`,
		`create or replace table measure.app_filters
(
  team_id LowCardinality(UUID) CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  end_of_month DateTime comment 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
  country_code LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
  network_provider LowCardinality(String) comment 'network provider' CODEC(ZSTD(3)),
  network_type LowCardinality(String) comment 'network type' CODEC(ZSTD(3)),
  network_generation LowCardinality(String) comment 'network generation' CODEC(ZSTD(3)),
  device_locale LowCardinality(String) comment 'device locale' CODEC(ZSTD(3)),
  device_manufacturer LowCardinality(String) comment 'device manufacturer' CODEC(ZSTD(3)),
  device_name LowCardinality(String) comment 'device name' CODEC(ZSTD(3)),
  exception Bool comment 'true if source is exception event' CODEC(ZSTD(3)),
  anr Bool comment 'true if source is anr event' CODEC(ZSTD(3))
)
engine = ReplacingMergeTree
partition by toYYYYMM(end_of_month)
primary key (team_id, app_id, end_of_month)
order by (team_id, app_id, end_of_month, exception, anr, network_type, network_generation, os_version, app_version, country_code, device_manufacturer, device_locale, network_provider, device_name)
settings index_granularity = 8192
comment 'derived app filters'`,

		`create materialized view measure.app_filters_mv to measure.app_filters
(
  team_id UUID,
  app_id UUID,
  end_of_month Date,
  app_version Tuple(LowCardinality(String), LowCardinality(String)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)),
  country_code LowCardinality(String),
  network_provider LowCardinality(String),
  network_type LowCardinality(String),
  network_generation LowCardinality(String),
  device_locale LowCardinality(String),
  device_manufacturer LowCardinality(String),
  device_name LowCardinality(String),
  exception Bool,
  anr Bool
) as select
  team_id,
  app_id,
  toLastDayOfMonth(timestamp) as end_of_month,
  (attribute.app_version, attribute.app_build) as app_version,
  (attribute.os_name, attribute.os_version) as os_version,
  inet.country_code as country_code,
  attribute.network_provider as network_provider,
  attribute.network_type as network_type,
  attribute.network_generation as network_generation,
  attribute.device_locale as device_locale,
  attribute.device_manufacturer as device_manufacturer,
  attribute.device_name as device_name,
  max(type = 'exception' and exception.handled = 0) as exception,
  max(type = 'anr') as anr
from measure.events
where
  attribute.os_name != ''
  and attribute.os_version != ''
  and inet.country_code != ''
  and attribute.network_provider != ''
  and attribute.network_type != ''
  and attribute.network_generation != ''
  and attribute.device_locale != ''
  and attribute.device_manufacturer != ''
  and attribute.device_name != ''
group by
  team_id, app_id, end_of_month, app_version, os_version,
  country_code, network_provider, network_type, network_generation,
  device_locale, device_manufacturer, device_name`,

		// ----- app_metrics -----
		`drop table if exists measure.app_metrics_mv sync`,
		`create or replace table measure.app_metrics
(
  team_id LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  timestamp DateTime64(3, 'UTC') comment 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  unique_sessions AggregateFunction(uniq, UUID) comment 'unique sessions in interval window' CODEC(ZSTD(3)),
  crash_sessions AggregateFunction(uniq, UUID) comment 'crash sessions in interval window' CODEC(ZSTD(3)),
  perceived_crash_sessions AggregateFunction(uniq, UUID) comment 'perceived crash sessions in interval window' CODEC(ZSTD(3)),
  anr_sessions AggregateFunction(uniq, UUID) comment 'anr sessions in interval window' CODEC(ZSTD(3)),
  perceived_anr_sessions AggregateFunction(uniq, UUID) comment 'perceived anr sessions in interval window' CODEC(ZSTD(3)),
  cold_launch_p95 AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of cold launch duration' CODEC(ZSTD(3)),
  warm_launch_p95 AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of warm launch duration' CODEC(ZSTD(3)),
  hot_launch_p95 AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of hot launch duration' CODEC(ZSTD(3)),

  index app_version_name_idx app_version.1 type set(1000) granularity 2,
  index app_version_code_idx app_version.2 type set(1000) granularity 2
)
engine = AggregatingMergeTree
partition by toYYYYMM(timestamp)
primary key (team_id, app_id, timestamp)
order by (team_id, app_id, timestamp, app_version)
settings index_granularity = 8192
comment 'aggregated app metrics by a fixed time window'`,

		`create materialized view measure.app_metrics_mv to measure.app_metrics
as select
  team_id,
  app_id,
  toStartOfFifteenMinutes(timestamp) as timestamp,
  (attribute.app_version, attribute.app_build) as app_version,
  uniqState(session_id) as unique_sessions,
  uniqStateIf(session_id, type = 'exception' and exception.handled = 0) as crash_sessions,
  uniqStateIf(session_id, type = 'exception' and exception.handled = 0 and exception.foreground = 1) as perceived_crash_sessions,
  uniqStateIf(session_id, type = 'anr') as anr_sessions,
  uniqStateIf(session_id, type = 'anr' and anr.foreground = 1) as perceived_anr_sessions,
  quantileStateIf(0.95)(cold_launch.duration, type = 'cold_launch' and cold_launch.duration > 0 and cold_launch.duration <= 30000) as cold_launch_p95,
  quantileStateIf(0.95)(warm_launch.duration, type = 'warm_launch' and warm_launch.duration > 0 and warm_launch.duration <= 10000) as warm_launch_p95,
  quantileStateIf(0.95)(hot_launch.duration, type = 'hot_launch' and hot_launch.duration > 0) as hot_launch_p95
from measure.events
group by team_id, app_id, timestamp, app_version`,

		// ----- user_def_attrs -----
		`drop table if exists measure.user_def_attrs_mv sync`,
		`create or replace table measure.user_def_attrs
(
  team_id LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  event_id UUID comment 'id of the event' CODEC(LZ4),
  session_id UUID comment 'id of the session' CODEC(LZ4),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
  bug_report Bool comment 'true if source is bug_report event' CODEC(ZSTD(3)),
  key LowCardinality(String) comment 'key of the user defined attribute' CODEC(ZSTD(3)),
  type Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4) comment 'type of the user defined attribute' CODEC(ZSTD(3)),
  value String comment 'value of the user defined attribute' CODEC(ZSTD(3)),
  timestamp DateTime64(3, 'UTC') comment 'event timestamp' CODEC(DoubleDelta, ZSTD(3)),

  index timestamp_minmax_idx timestamp type minmax granularity 2,
  index os_version_bloom_idx toString(os_version) type bloom_filter(0.05) granularity 4,
  index os_version_set_idx os_version type set(1000) granularity 2,
  index bug_report_bloom_idx bug_report type bloom_filter(0.05) granularity 2,
  index key_bloom_idx key type bloom_filter(0.05) granularity 1,
  index key_set_idx key type set(5000) granularity 2,
  index session_bloom_idx session_id type bloom_filter(0.05) granularity 2
)
engine = ReplacingMergeTree(timestamp)
partition by toYYYYMM(timestamp)
primary key (team_id, app_id, app_version.1, app_version.2)
order by (team_id, app_id, app_version.1, app_version.2, os_version.1, os_version.2, type, key, event_id, value)
settings index_granularity = 8192
comment 'derived user defined attributes'`,

		`create materialized view measure.user_def_attrs_mv to measure.user_def_attrs
(
  team_id UUID,
  app_id UUID,
  event_id UUID,
  session_id UUID,
  app_version Tuple(LowCardinality(String), LowCardinality(String)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)),
  bug_report Bool,
  key LowCardinality(String),
  type Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
  value String,
  timestamp DateTime64(3, 'UTC')
)
as select distinct
  e.team_id,
  e.app_id,
  e.id as event_id,
  e.session_id,
  (e.attribute.app_version, e.attribute.app_build) as app_version,
  (e.attribute.os_name, e.attribute.os_version) as os_version,
  if(e.type = 'bug_report', true, false) as bug_report,
  arr_key as key,
  arr_val.1 as type,
  arr_val.2 as value,
  e.timestamp as timestamp
from measure.events as e
array join
  mapKeys(e.user_defined_attribute) as arr_key,
  mapValues(e.user_defined_attribute) as arr_val
where length(e.user_defined_attribute) > 0
group by
  team_id, app_id, app_version, os_version, e.type,
  key, type, value, event_id, session_id, timestamp`,

		// ----- span_filters -----
		`drop table if exists measure.span_filters_mv sync`,
		`create or replace table measure.span_filters
(
  team_id LowCardinality(UUID) CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  end_of_month DateTime comment 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
  country_code LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
  network_provider LowCardinality(String) comment 'network provider' CODEC(ZSTD(3)),
  network_type LowCardinality(String) comment 'network type' CODEC(ZSTD(3)),
  network_generation LowCardinality(String) comment 'network generation' CODEC(ZSTD(3)),
  device_locale LowCardinality(String) comment 'device locale' CODEC(ZSTD(3)),
  device_manufacturer LowCardinality(String) comment 'device manufacturer' CODEC(ZSTD(3)),
  device_name LowCardinality(String) comment 'device name' CODEC(ZSTD(3))
)
engine = ReplacingMergeTree
primary key (team_id, app_id, end_of_month)
order by (team_id, app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
settings index_granularity = 8192
comment 'derived span filters'`,

		`create materialized view measure.span_filters_mv to measure.span_filters
(
  team_id UUID,
  app_id UUID,
  end_of_month Date,
  app_version String,
  os_version String,
  country_code LowCardinality(String),
  network_provider LowCardinality(String),
  network_type LowCardinality(String),
  network_generation LowCardinality(String),
  device_locale LowCardinality(String),
  device_manufacturer LowCardinality(String),
  device_name LowCardinality(String)
)
as select distinct
  team_id,
  app_id,
  toLastDayOfMonth(start_time) AS end_of_month,
  attribute.app_version AS app_version,
  attribute.os_version AS os_version,
  attribute.country_code AS country_code,
  attribute.network_provider AS network_provider,
  attribute.network_type AS network_type,
  attribute.network_generation AS network_generation,
  attribute.device_locale AS device_locale,
  attribute.device_manufacturer AS device_manufacturer,
  attribute.device_name AS device_name
from measure.spans
where
  (toString(attribute.os_version) != '')
  and (toString(attribute.country_code) != '')
  and (toString(attribute.network_provider) != '')
  and (toString(attribute.network_type) != '')
  and (toString(attribute.network_generation) != '')
  and (toString(attribute.device_locale) != '')
  and (toString(attribute.device_manufacturer) != '')
  and (toString(attribute.device_name) != '')
group by
  team_id, app_id, end_of_month,
  attribute.app_version, attribute.os_version,
  attribute.country_code, attribute.network_provider,
  attribute.network_type, attribute.network_generation,
  attribute.device_locale, attribute.device_manufacturer,
  attribute.device_name`,

		// ----- span_metrics (MV only — table already in schemaFixes above) -----
		`drop table if exists measure.span_metrics_mv sync`,
		`create materialized view measure.span_metrics_mv to measure.span_metrics
(
  team_id UUID,
  app_id UUID,
  span_name LowCardinality(String),
  span_id FixedString(16),
  status UInt8,
  timestamp DateTime('UTC'),
  app_version Tuple(LowCardinality(String), LowCardinality(String)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)),
  country_code LowCardinality(String),
  network_provider LowCardinality(String),
  network_type LowCardinality(String),
  network_generation LowCardinality(String),
  device_locale LowCardinality(String),
  device_manufacturer LowCardinality(String),
  device_name LowCardinality(String),
  device_low_power_mode Bool,
  device_thermal_throttling_enabled Bool,
  p50 AggregateFunction(quantile(0.5), Int64),
  p90 AggregateFunction(quantile(0.9), Int64),
  p95 AggregateFunction(quantile(0.95), Int64),
  p99 AggregateFunction(quantile(0.99), Int64)
)
as select
  team_id,
  app_id,
  span_name,
  span_id,
  status,
  toStartOfFifteenMinutes(start_time) AS timestamp,
  attribute.app_version AS app_version,
  attribute.os_version AS os_version,
  attribute.country_code AS country_code,
  attribute.network_provider AS network_provider,
  attribute.network_type AS network_type,
  attribute.network_generation AS network_generation,
  attribute.device_locale AS device_locale,
  attribute.device_manufacturer AS device_manufacturer,
  attribute.device_name AS device_name,
  attribute.device_low_power_mode AS device_low_power_mode,
  attribute.device_thermal_throttling_enabled AS device_thermal_throttling_enabled,
  quantileState(0.5)(dateDiff('ms', start_time, end_time)) AS p50,
  quantileState(0.9)(dateDiff('ms', start_time, end_time)) AS p90,
  quantileState(0.95)(dateDiff('ms', start_time, end_time)) AS p95,
  quantileState(0.99)(dateDiff('ms', start_time, end_time)) AS p99
from measure.spans
group by
  team_id, app_id, span_name, span_id, status, timestamp,
  app_version, os_version, country_code, network_provider,
  network_type, network_generation, device_locale,
  device_manufacturer, device_name,
  device_low_power_mode, device_thermal_throttling_enabled`,

		// ----- span_user_def_attrs -----
		`drop table if exists measure.span_user_def_attrs_mv sync`,
		`create or replace table measure.span_user_def_attrs
(
  team_id LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  app_id LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  span_id FixedString(16) comment 'id of the span' CODEC(LZ4),
  session_id UUID comment 'id of the session' CODEC(LZ4),
  app_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
  key LowCardinality(String) comment 'key of the user defined attribute' CODEC(ZSTD(3)),
  type Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4) comment 'type of the user defined attribute' CODEC(ZSTD(3)),
  value String comment 'value of the user defined attribute' CODEC(ZSTD(3)),
  timestamp DateTime64(3, 'UTC') comment 'start time of the span',

  index timestamp_minmax_idx timestamp type minmax granularity 2,
  index os_version_bloom_idx toString(os_version) type bloom_filter(0.05) granularity 4,
  index os_version_set_idx os_version type set(1000) granularity 2,
  index key_bloom_idx key type bloom_filter(0.05) granularity 1,
  index key_set_idx key type set(5000) granularity 2,
  index session_bloom_idx session_id type bloom_filter(0.05) granularity 2
)
engine = ReplacingMergeTree(timestamp)
partition by toYYYYMM(timestamp)
primary key (team_id, app_id, app_version.1, app_version.2)
order by (team_id, app_id, app_version.1, app_version.2, os_version.1, os_version.2, type, key, span_id, value)
settings index_granularity = 8192
comment 'derived span user defined attributes'`,

		`create materialized view measure.span_user_def_attrs_mv to measure.span_user_def_attrs
(
  team_id UUID,
  app_id UUID,
  span_id FixedString(16),
  session_id UUID,
  app_version Tuple(LowCardinality(String), LowCardinality(String)),
  os_version Tuple(LowCardinality(String), LowCardinality(String)),
  key LowCardinality(String),
  type Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
  value String,
  timestamp DateTime64(3, 'UTC')
)
as select distinct
  team_id,
  app_id,
  span_id,
  session_id,
  attribute.app_version as app_version,
  attribute.os_version as os_version,
  arr_key as key,
  arr_val.1 as type,
  arr_val.2 as value,
  start_time as timestamp
from measure.spans
array join
  mapKeys(user_defined_attribute) as arr_key,
  mapValues(user_defined_attribute) as arr_val
where length(user_defined_attribute) > 0
group by
  team_id, app_id, app_version, os_version,
  key, type, value, span_id, session_id, timestamp`,
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
