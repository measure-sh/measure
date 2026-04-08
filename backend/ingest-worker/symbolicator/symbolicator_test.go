//go:build integration

package symbolicator

import (
	"backend/api/event"
	"backend/libs/symbol"
	"backend/testinfra"
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	pgPool              *pgxpool.Pool
	symbolicatorOrigin  string
	minioEndpoint       string
	s3Client            *s3.Client
	symbolsBucket       = "test-symbols"
	proguardMappingKey  string // unified layout key for the proguard mapping
	proguardDebugID     string // UUID-formatted debug ID for the proguard mapping
	update              = flag.Bool("update", false, "update golden files")
	testdataDir         string
)

func TestMain(m *testing.M) {
	flag.Parse()
	ctx := context.Background()

	// Resolve testdata directory
	_, filename, _, _ := runtime.Caller(0)
	testdataDir = filepath.Join(filepath.Dir(filename), "testdata")

	// Override retry duration for faster tests
	defaultRetryDuration = 1 * time.Second

	// 1. Create shared Docker network
	nw, err := network.New(ctx, network.WithCheckDuplicate())
	if err != nil {
		fmt.Printf("failed to create docker network: %v\n", err)
		os.Exit(1)
	}

	networkName := nw.Name

	// 2. Start PostgreSQL via testinfra
	pool, pgCleanup := testinfra.SetupPostgres(ctx)
	pgPool = pool

	// 3. Start MinIO
	minioContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "quay.io/minio/minio:latest",
			ExposedPorts: []string{"9000/tcp"},
			Env: map[string]string{
				"MINIO_ROOT_USER":     "minioadmin",
				"MINIO_ROOT_PASSWORD": "minioadmin",
			},
			Cmd:        []string{"server", "/data"},
			Networks:   []string{networkName},
			NetworkAliases: map[string][]string{
				networkName: {"minio"},
			},
			WaitingFor: wait.ForHTTP("/minio/health/live").WithPort("9000/tcp").WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		fmt.Printf("failed to start minio: %v\n", err)
		os.Exit(1)
	}

	minioHost, _ := minioContainer.Host(ctx)
	minioPort, _ := minioContainer.MappedPort(ctx, "9000/tcp")
	minioEndpoint = fmt.Sprintf("http://%s:%s", minioHost, minioPort.Port())

	// Create S3 client for MinIO
	s3Client = s3.New(s3.Options{
		BaseEndpoint: aws.String(minioEndpoint),
		Region:       "us-east-1",
		Credentials:  credentials.NewStaticCredentialsProvider("minioadmin", "minioadmin", ""),
		UsePathStyle: true,
	})

	// Create symbols bucket
	_, err = s3Client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(symbolsBucket),
	})
	if err != nil {
		fmt.Printf("failed to create bucket: %v\n", err)
		os.Exit(1)
	}

	// Upload proguard mapping file to MinIO
	mappingBytes, err := os.ReadFile(filepath.Join(testdataDir, "mapping.txt"))
	if err != nil {
		fmt.Printf("failed to read mapping.txt: %v\n", err)
		os.Exit(1)
	}

	// Compute debug ID the same way symboloader does
	ns := uuid.NewSHA1(uuid.NameSpaceDNS, []byte("guardsquare.com"))
	debugUUID := uuid.NewSHA1(ns, mappingBytes)
	proguardMappingKey = symbol.BuildUnifiedLayout(debugUUID.String()) + "/proguard"
	proguardDebugID = symbol.MappingKeyToDebugId(symbol.BuildUnifiedLayout(debugUUID.String()))

	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(symbolsBucket),
		Key:    aws.String(proguardMappingKey),
		Body:   bytes.NewReader(mappingBytes),
	})
	if err != nil {
		fmt.Printf("failed to upload mapping to minio: %v\n", err)
		os.Exit(1)
	}

	// 4. Start Symbolicator
	configPath := filepath.Join(testdataDir, "symbolicator.yml")
	symbolicatorContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "ghcr.io/measure-sh/symbolicator",
			ExposedPorts: []string{"3021/tcp"},
			Files: []testcontainers.ContainerFile{
				{
					HostFilePath:      configPath,
					ContainerFilePath: "/etc/symbolicator/config.yml",
					FileMode:          0o444,
				},
			},
			Cmd:      []string{"run", "-c", "/etc/symbolicator/config.yml"},
			Networks: []string{networkName},
			NetworkAliases: map[string][]string{
				networkName: {"symbolicator"},
			},
			WaitingFor: wait.ForHTTP("/healthcheck").WithPort("3021/tcp").WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		fmt.Printf("failed to start symbolicator: %v\n", err)
		os.Exit(1)
	}

	symbolicatorHost, _ := symbolicatorContainer.Host(ctx)
	symbolicatorPort, _ := symbolicatorContainer.MappedPort(ctx, "3021/tcp")
	symbolicatorOrigin = fmt.Sprintf("http://%s:%s", symbolicatorHost, symbolicatorPort.Port())

	// Run tests, then clean up explicitly before exiting.
	// os.Exit skips defers, so cleanup must happen before the call.
	code := m.Run()

	symbolicatorContainer.Terminate(ctx)
	minioContainer.Terminate(ctx)
	pgCleanup()
	nw.Remove(ctx)

	os.Exit(code)
}

// seedApp creates a team and app in Postgres for testing.
func seedApp(ctx context.Context, t *testing.T, appID uuid.UUID) {
	t.Helper()
	teamID := uuid.New()
	now := time.Now()

	_, err := pgPool.Exec(ctx,
		`INSERT INTO teams (id, name, allow_ingest, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		teamID, "test-team", true, now, now)
	if err != nil {
		t.Fatalf("seed team: %v", err)
	}

	_, err = pgPool.Exec(ctx,
		`INSERT INTO apps (id, team_id, app_name, unique_identifier, os_name, first_version, onboarded, onboarded_at, retention, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		appID, teamID, "test-app", "sh.measure.test", "android", "1.0.0", true, now, 90, now, now)
	if err != nil {
		t.Fatalf("seed app: %v", err)
	}
}

// seedBuildMapping inserts a build mapping entry in Postgres.
func seedBuildMapping(ctx context.Context, t *testing.T, appID uuid.UUID, versionName, versionCode, mappingType, key string) {
	t.Helper()
	now := time.Now()

	_, err := pgPool.Exec(ctx,
		`INSERT INTO build_mappings (id, app_id, version_name, version_code, mapping_type, key, location, fnv1_hash, file_size, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		uuid.New(), appID, versionName, versionCode, mappingType, key, "s3://"+symbolsBucket+"/"+key, "0000000000000000", 100, now)
	if err != nil {
		t.Fatalf("seed build mapping: %v", err)
	}
}

// newS3Source creates an S3 source for Android that points to the MinIO
// instance. The Region field uses the Docker network alias so the
// symbolicator container can reach MinIO.
func newS3Source() Source {
	return NewS3SourceAndroid(
		"test-source",
		symbolsBucket,
		"us-east-1",
		"http://minio:9000", // Docker network alias
		"minioadmin",
		"minioadmin",
	)
}

// makeJVMExceptionEvents creates EventField entries with obfuscated
// class/method names that match the test mapping.txt.
func makeJVMExceptionEvents(versionName, versionCode string) []event.EventField {
	return []event.EventField{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeException,
			Attribute: event.Attribute{
				AppVersion: versionName,
				AppBuild:   versionCode,
				OSName:     "android",
			},
			Exception: &event.Exception{
				Handled: false,
				Exceptions: event.ExceptionUnits{
					{
						Type:    "java.lang.IllegalStateException",
						Message: "Test exception",
						Frames: event.Frames{
							{
								LineNum:    29,
								ClassName:  "a.b.c",
								MethodName: "d",
								FileName:   "SourceFile",
							},
							{
								LineNum:    7506,
								ClassName:  "android.view.View",
								MethodName: "performClick",
								FileName:   "View.java",
							},
						},
					},
				},
				Threads: event.Threads{
					{
						Name: "Thread-2",
						Frames: event.Frames{
							{
								LineNum:    102,
								ClassName:  "f.g",
								MethodName: "h",
								FileName:   "SourceFile",
							},
						},
					},
				},
			},
		},
	}
}

// makeJVMANREvents creates EventField entries with obfuscated ANR events.
func makeJVMANREvents(versionName, versionCode string) []event.EventField {
	return []event.EventField{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeANR,
			Attribute: event.Attribute{
				AppVersion: versionName,
				AppBuild:   versionCode,
				OSName:     "android",
			},
			ANR: &event.ANR{
				Handled: false,
				Exceptions: event.ExceptionUnits{
					{
						Type:    "java.lang.RuntimeException",
						Message: "ANR detected",
						Frames: event.Frames{
							{
								LineNum:    50,
								ClassName:  "i.j",
								MethodName: "k",
								FileName:   "SourceFile",
							},
							{
								LineNum:    -2,
								ClassName:  "java.lang.Thread",
								MethodName: "sleep",
								FileName:   "Thread.java",
							},
						},
					},
				},
				Threads: event.Threads{
					{
						Name: "main",
						Frames: event.Frames{
							{
								LineNum:    29,
								ClassName:  "a.b.c",
								MethodName: "d",
								FileName:   "SourceFile",
							},
						},
					},
				},
			},
		},
	}
}

// makeJVMLifecycleEvents creates lifecycle + launch + app_exit events
// with obfuscated class names.
func makeJVMLifecycleEvents(versionName, versionCode string) []event.EventField {
	attr := event.Attribute{
		AppVersion: versionName,
		AppBuild:   versionCode,
		OSName:     "android",
	}
	return []event.EventField{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeLifecycleActivity,
			Attribute: attr,
			LifecycleActivity: &event.LifecycleActivity{
				Type:      "created",
				ClassName: "a.b.c",
			},
		},
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeLifecycleFragment,
			Attribute: attr,
			LifecycleFragment: &event.LifecycleFragment{
				Type:           "attached",
				ClassName:      "q.r",
				ParentActivity: "a.b.c",
			},
		},
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeColdLaunch,
			Attribute: attr,
			ColdLaunch: &event.ColdLaunch{
				LaunchedActivity: "o.p",
				OnNextDrawUptime: 1000,
			},
		},
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeHotLaunch,
			Attribute: attr,
			HotLaunch: &event.HotLaunch{
				LaunchedActivity: "l.m",
				OnNextDrawUptime: 500,
			},
		},
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeAppExit,
			Attribute: attr,
			AppExit: &event.AppExit{
				Reason:      "CRASH",
				Importance:  "FOREGROUND",
				Trace:       "a.b.c",
				ProcessName: "sh.measure.test",
				PID:         "12345",
			},
		},
	}
}

// extractSymbolicatedFields extracts only the fields that symbolication
// modifies, for golden file comparison. This avoids issues with
// non-deterministic fields like UUID, timestamps, etc.
type symbolicatedResult struct {
	Type string `json:"type"`
	// Exception fields
	ExceptionTypes   []string          `json:"exception_types,omitempty"`
	ExceptionFrames  [][]goldenFrame   `json:"exception_frames,omitempty"`
	ThreadFrames     [][]goldenFrame   `json:"thread_frames,omitempty"`
	// Lifecycle fields
	ClassName        string            `json:"class_name,omitempty"`
	ParentActivity   string            `json:"parent_activity,omitempty"`
	ParentFragment   string            `json:"parent_fragment,omitempty"`
	LaunchedActivity string            `json:"launched_activity,omitempty"`
	Trace            string            `json:"trace,omitempty"`
}

type goldenFrame struct {
	ClassName  string `json:"class_name"`
	MethodName string `json:"method_name"`
	FileName   string `json:"file_name"`
	LineNum    int    `json:"line_num"`
}

func extractResult(events []event.EventField) []symbolicatedResult {
	results := make([]symbolicatedResult, 0, len(events))
	for _, ev := range events {
		r := symbolicatedResult{Type: ev.Type}
		switch ev.Type {
		case event.TypeException:
			for _, exc := range ev.Exception.Exceptions {
				r.ExceptionTypes = append(r.ExceptionTypes, exc.Type)
				frames := make([]goldenFrame, 0, len(exc.Frames))
				for _, f := range exc.Frames {
					frames = append(frames, goldenFrame{
						ClassName:  f.ClassName,
						MethodName: f.MethodName,
						FileName:   f.FileName,
						LineNum:    f.LineNum,
					})
				}
				r.ExceptionFrames = append(r.ExceptionFrames, frames)
			}
			for _, th := range ev.Exception.Threads {
				frames := make([]goldenFrame, 0, len(th.Frames))
				for _, f := range th.Frames {
					frames = append(frames, goldenFrame{
						ClassName:  f.ClassName,
						MethodName: f.MethodName,
						FileName:   f.FileName,
						LineNum:    f.LineNum,
					})
				}
				r.ThreadFrames = append(r.ThreadFrames, frames)
			}
		case event.TypeANR:
			for _, exc := range ev.ANR.Exceptions {
				r.ExceptionTypes = append(r.ExceptionTypes, exc.Type)
				frames := make([]goldenFrame, 0, len(exc.Frames))
				for _, f := range exc.Frames {
					frames = append(frames, goldenFrame{
						ClassName:  f.ClassName,
						MethodName: f.MethodName,
						FileName:   f.FileName,
						LineNum:    f.LineNum,
					})
				}
				r.ExceptionFrames = append(r.ExceptionFrames, frames)
			}
			for _, th := range ev.ANR.Threads {
				frames := make([]goldenFrame, 0, len(th.Frames))
				for _, f := range th.Frames {
					frames = append(frames, goldenFrame{
						ClassName:  f.ClassName,
						MethodName: f.MethodName,
						FileName:   f.FileName,
						LineNum:    f.LineNum,
					})
				}
				r.ThreadFrames = append(r.ThreadFrames, frames)
			}
		case event.TypeLifecycleActivity:
			r.ClassName = ev.LifecycleActivity.ClassName
		case event.TypeLifecycleFragment:
			r.ClassName = ev.LifecycleFragment.ClassName
			r.ParentActivity = ev.LifecycleFragment.ParentActivity
			r.ParentFragment = ev.LifecycleFragment.ParentFragment
		case event.TypeColdLaunch:
			r.LaunchedActivity = ev.ColdLaunch.LaunchedActivity
		case event.TypeWarmLaunch:
			r.LaunchedActivity = ev.WarmLaunch.LaunchedActivity
		case event.TypeHotLaunch:
			r.LaunchedActivity = ev.HotLaunch.LaunchedActivity
		case event.TypeAppExit:
			r.Trace = ev.AppExit.Trace
		}
		results = append(results, r)
	}
	return results
}

func assertMatchesGolden(t *testing.T, goldenFile string, results []symbolicatedResult) {
	t.Helper()

	got, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		t.Fatalf("marshal results: %v", err)
	}

	goldenPath := filepath.Join(testdataDir, goldenFile)

	if *update {
		if err := os.WriteFile(goldenPath, got, 0o644); err != nil {
			t.Fatalf("update golden file: %v", err)
		}
		t.Logf("updated golden file: %s", goldenPath)
		return
	}

	want, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden file %s: %v (run with -update to generate)", goldenFile, err)
	}

	if !bytes.Equal(got, want) {
		t.Errorf("symbolication output does not match golden file %s\n\ngot:\n%s\n\nwant:\n%s", goldenFile, string(got), string(want))
	}
}

func TestJVMExceptionSymbolication(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	versionName := "1.0.0"
	versionCode := "1"

	seedApp(ctx, t, appID)
	seedBuildMapping(ctx, t, appID, versionName, versionCode, "proguard", proguardMappingKey)

	events := makeJVMExceptionEvents(versionName, versionCode)
	sources := []Source{newS3Source()}

	symb := New(symbolicatorOrigin, "android", sources)
	err := symb.Symbolicate(ctx, pgPool, appID, events, nil)
	if err != nil {
		t.Fatalf("Symbolicate failed: %v", err)
	}

	results := extractResult(events)
	assertMatchesGolden(t, "jvm_exception_golden.json", results)
}

func TestJVMANRSymbolication(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	versionName := "1.0.0"
	versionCode := "2"

	seedApp(ctx, t, appID)
	seedBuildMapping(ctx, t, appID, versionName, versionCode, "proguard", proguardMappingKey)

	events := makeJVMANREvents(versionName, versionCode)
	sources := []Source{newS3Source()}

	symb := New(symbolicatorOrigin, "android", sources)
	err := symb.Symbolicate(ctx, pgPool, appID, events, nil)
	if err != nil {
		t.Fatalf("Symbolicate failed: %v", err)
	}

	results := extractResult(events)
	assertMatchesGolden(t, "jvm_anr_golden.json", results)
}

func TestJVMLifecycleSymbolication(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	versionName := "1.0.0"
	versionCode := "3"

	seedApp(ctx, t, appID)
	seedBuildMapping(ctx, t, appID, versionName, versionCode, "proguard", proguardMappingKey)

	events := makeJVMLifecycleEvents(versionName, versionCode)
	sources := []Source{newS3Source()}

	symb := New(symbolicatorOrigin, "android", sources)
	err := symb.Symbolicate(ctx, pgPool, appID, events, nil)
	if err != nil {
		t.Fatalf("Symbolicate failed: %v", err)
	}

	results := extractResult(events)
	assertMatchesGolden(t, "jvm_lifecycle_golden.json", results)
}

func TestSymbolicationNoMapping(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	versionName := "99.0.0"
	versionCode := "99"

	seedApp(ctx, t, appID)
	// No build mapping seeded - version has no mapping file

	events := makeJVMExceptionEvents(versionName, versionCode)
	sources := []Source{newS3Source()}

	// Save original class names
	origClassName := events[0].Exception.Exceptions[0].Frames[0].ClassName
	origMethodName := events[0].Exception.Exceptions[0].Frames[0].MethodName

	symb := New(symbolicatorOrigin, "android", sources)
	err := symb.Symbolicate(ctx, pgPool, appID, events, nil)
	if err != nil {
		t.Fatalf("Symbolicate failed: %v", err)
	}

	// Events should be unchanged
	if events[0].Exception.Exceptions[0].Frames[0].ClassName != origClassName {
		t.Errorf("expected class name to remain %q, got %q", origClassName, events[0].Exception.Exceptions[0].Frames[0].ClassName)
	}
	if events[0].Exception.Exceptions[0].Frames[0].MethodName != origMethodName {
		t.Errorf("expected method name to remain %q, got %q", origMethodName, events[0].Exception.Exceptions[0].Frames[0].MethodName)
	}
}

func TestSymbolicationNonSymbolicatableEvents(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()
	versionName := "1.0.0"
	versionCode := "4"

	seedApp(ctx, t, appID)
	seedBuildMapping(ctx, t, appID, versionName, versionCode, "proguard", proguardMappingKey)

	// Create a gesture_click event - should not be symbolicated
	events := []event.EventField{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Timestamp: time.Now(),
			Type:      event.TypeGestureClick,
			Attribute: event.Attribute{
				AppVersion: versionName,
				AppBuild:   versionCode,
				OSName:     "android",
			},
			GestureClick: &event.GestureClick{
				Target:   "a.b.c",
				TargetID: "button1",
			},
		},
	}

	origTarget := events[0].GestureClick.Target

	sources := []Source{newS3Source()}
	symb := New(symbolicatorOrigin, "android", sources)
	err := symb.Symbolicate(ctx, pgPool, appID, events, nil)
	if err != nil {
		t.Fatalf("Symbolicate failed: %v", err)
	}

	// Event should be unchanged
	if events[0].GestureClick.Target != origTarget {
		t.Errorf("expected target to remain %q, got %q", origTarget, events[0].GestureClick.Target)
	}
}
