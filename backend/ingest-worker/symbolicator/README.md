# symbolicator

Package symbolicator performs de-obfuscation and symbolication of crash data across Android (JVM), iOS (Apple), and Flutter (Dart) platforms.

It communicates with the [Sentry Symbolicator](https://github.com/getsentry/symbolicator) service over HTTP to resolve obfuscated class names, method names, instruction addresses, and symbol addresses into human-readable stack traces.

## How It Works

The entry point is `Symbolicate()`, which takes a batch of events, determines which ones need symbolication, and dispatches them to the appropriate platform handler:

- **JVM (Android)** - Sends obfuscated class/method names to `/symbolicate-jvm` with a ProGuard mapping file. Handles inline frame expansion and the lambda workaround for R8 synthetic classes. ProGuard files are fetched via a Sentry source (HTTP from symboloader).
- **Apple (iOS)** - Constructs an Apple crash report from binary image addresses and sends it to `/applecrashreport` with dSYM debug symbols. Symbolicated per-event (not batched).
- **Dart (Flutter)** - Sends instruction addresses to `/symbolicate` with ELF debug symbols. Handles inline frame expansion.

Mapping files (ProGuard `.txt`, dSYM Mach-O binaries, ELF `.symbols`) are stored in S3-compatible object storage using Sentry's unified layout format. The symbolicator service fetches them on demand via source configurations passed in each request. Two source types are used:

- **S3/GCS sources** (`Source`) - Used for Apple dSYM and Dart ELF files. The symbolicator resolves S3 paths directly from debug IDs using the unified layout.
- **Sentry sources** (`SentrySource`) - Used for JVM ProGuard files. Required because symbolicator 26.3.1+ cannot resolve ProGuard files from S3 paths (`FileType::Proguard => None` in path generation). The symbolicator fetches ProGuard files via HTTP from the symboloader's `/symbols` endpoint, which implements the Sentry source protocol.

## Tests

### Running Tests

Integration tests require Docker (PostgreSQL, MinIO, and Symbolicator containers are started automatically via testcontainers).

```bash
# from backend/ingest-worker/symbolicator/
go test -tags integration -v -count=1 -timeout 300s
```

### What the Tests Cover

**Basic JVM tests** (synthetic mapping file):
- `TestJVMExceptionSymbolicationBasic` - Single exception with obfuscated class/method names
- `TestJVMANRSymbolicationBasic` - ANR event with exceptions and threads, negative line number preservation
- `TestJVMLifecycleSymbolicationBasic` - Batch of lifecycle_activity, lifecycle_fragment, cold_launch, hot_launch, and app_exit events

**Real-world JVM tests** (production ProGuard mapping, ~350K lines):
- `TestJVMSingleExceptionReal` - Nested exception with inline frame expansion via R8 line-number-range mapping
- `TestJVMNestedExceptionReal` - 4 nested exceptions with custom exception type deobfuscation

**Apple tests** (real dSYM from DemoApp):
- `TestAppleExceptionSymbolication` - SIGABRT crash, 30 frames, 23 threads, 13 binary images
- `TestAppleNSExceptionSymbolication` - NSRangeException crash

**Dart/Flutter test** (real ELF debug symbols):
- `TestDartExceptionSymbolication` - FormatException with 20 instruction-address frames, inline frame expansion

**Edge cases**:
- `TestSymbolicationNoMapping` - Events with no mapping file pass through unmodified
- `TestSymbolicationNonSymbolicatableEvents` - Non-symbolication events (e.g., gesture_click) are untouched

### Golden File Assertions

Each symbolication test asserts two things:

1. **Frame-level golden** (`*_golden.json`) - Verifies individual frame fields (class_name, method_name, file_name, line_num) match exactly after symbolication.
2. **Stacktrace string golden** (`*_stacktrace_golden.txt`) - Verifies the final formatted stacktrace string produced by `Exception.Stacktrace()` or `ANR.Stacktrace()` matches exactly.

### Updating Golden Files

When upgrading the symbolicator Docker image or making changes that intentionally alter symbolication output, regenerate golden files:

```bash
# regenerate all golden files
go test -tags integration -v -count=1 -timeout 300s -args -update

# regenerate only for specific tests
go test -tags integration -v -count=1 -timeout 300s -run TestApple -args -update
```

After regeneration, review the diffs in the golden files to confirm the changes are expected before committing.

### Test Infrastructure

Tests spin up three containers via testcontainers:

- **PostgreSQL** - Stores `build_mappings` entries (JVM and Dart tests need mapping lookups; Apple tests skip DB entirely)
- **MinIO** - S3-compatible object storage holding ProGuard mappings, dSYM binaries, and ELF debug symbols in unified layout
- **Symbolicator** - The Sentry symbolicator service (`ghcr.io/getsentry/symbolicator:26.3.1`)

A **Sentry source HTTP handler** also runs on the host, serving ProGuard files from MinIO via the Sentry source protocol (`?debug_id=` to list, `?id=` to download). The symbolicator container reaches it via `host.docker.internal`.

MinIO and Symbolicator share a Docker network so the symbolicator can fetch dSYM and ELF symbols from MinIO via S3 sources. All containers are cleaned up after test completion.

### Test Data

Fixture files live in `testdata/`:

| File | Description |
|------|-------------|
| `mapping_basic.txt` | Small synthetic ProGuard mapping for basic JVM tests |
| `mapping_real.txt` | Production ProGuard mapping (~39MB) for real-world JVM tests |
| `DemoApp` | Mach-O arm64 dSYM binary for Apple tests |
| `app.android-arm64.symbols` | ELF arm64 debug symbols for Dart/Flutter tests |
| `symbolicator.yml` | Symbolicator service configuration |
| `*_input.json` | Raw event/exception data loaded by tests |
| `*_golden.json` | Expected frame-level output after symbolication |
| `*_stacktrace_golden.txt` | Expected formatted stacktrace strings |
