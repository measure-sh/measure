# Performance Tests

Run the performance tests using the following command

```sh
flutter drive \
--driver=test_driver/perf_driver.dart \
--target=integration_test/layout_snapshot_performance_test.dart \
--profile \
--no-dds
```

Example output

```
All tests passed.

=== Performance Test Results ===
Open: chrome://tracing
Then load: /Users/abhaysood/measure/measure/flutter/example/build/layout_snapshot.timeline.json
```

The results for the benchmark are published [here](results). The trace can be opened in 
Perfetto or chrome://tracing for analysis.
