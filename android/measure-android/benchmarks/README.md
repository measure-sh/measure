# Benchmarks

* [Modules](#modules)
* [Running the benchmarks](#running-the-benchmarks)
* [Benchmarks](#benchmarks)
    * [Startup Benchmark](#startup-benchmark)
    * [View Click Benchmark](#view-click-benchmark)
    * [Compose Click Benchmark](#compose-click-benchmark)
    * [Baseline Profile Generator](#baseline-profile-generator)
* [Benchmark Comparison](#benchmark-comparison)
    * [Steps](#steps)
    * [Interpretation](#interpretation)
* [Benchmark Data Verification](#benchmark-data-verification)

This directory contains macro-benchmarks for `measure`. Two Gradle projects participate:

* [`:baseline-target`](../baseline-target) — a minimal app that depends on `:measure` and calls
  `Measure.init` in `Application.onCreate`. It is the application under test.
* `:benchmarks` — a `com.android.test` module containing the macro-benchmark tests and the
  baseline profile generator. It instruments `:baseline-target`.

The benchmarks measure (a) cold app startup with the Measure SDK initialized, under three
compilation modes, so regressions in `msr-init` or startup-path code paths are caught, and
(b) the synchronous cost of gesture tracking on both View and Compose hierarchies. The same
module also generates the baseline profile that ships with `:measure`.

# Running the benchmarks

Benchmarks must run on a real device for stable numbers. From Android Studio, pick the `benchmark`
build variant and click the gutter arrow next to a test in
[`StartupBenchmark`](src/main/java/sh/measure/benchmark/StartupBenchmark.kt). From the command line:

```bash
./gradlew :benchmarks:connectedBenchmarkBenchmarkAndroidTest
```

Output lands under `benchmarks/build/outputs/connected_android_test_additional_output/<device>/`.

# Benchmarks

### Startup Benchmark

[`StartupBenchmark`](src/main/java/sh/measure/benchmark/StartupBenchmark.kt) measures cold startup
of `:baseline-target` over 35 iterations. Each test captures `timeToInitialDisplayMs` plus a
`TraceSectionMetric` on `msr-init` (synchronous time spent inside `Measure.init`).

### View Click Benchmark

[`ViewClickBenchmark`](src/main/java/sh/measure/benchmark/ViewClickBenchmark.kt) launches
`ViewClickActivity` (a single `Button` in an XML layout) and taps it three times per iteration over
35 warm-start iterations.

### Compose Click Benchmark

[`ComposeClickBenchmark`](src/main/java/sh/measure/benchmark/ComposeClickBenchmark.kt) is the same
shape as the View benchmark but targets `ComposeClickActivity`, which hosts a `material3.Button`. 
This test exercises the `LayoutInspector`'s Compose semantics traversal rather than its 
View-hierarchy walk.

### Baseline Profile Generator

[`BaselineProfileGenerator`](src/main/java/sh/measure/benchmark/BaselineProfileGenerator.kt) runs
the `BaselineProfileRule` against `:baseline-target` to capture the code paths exercised during cold
start (which includes `Measure.init`). The resulting profile is consumed by `:measure` via the
`baselineProfile(project(":benchmarks"))` dependency and is checked in under
`measure/src/main/generated/baselineProfiles`.

```bash
./gradlew :measure:generateBaselineProfile
```

# Benchmark Comparison

These two posts are a must-read for the methodology:

* [Statistically rigorous android macrobenchmarks](https://blog.p-y.wtf/statistically-rigorous-android-macrobenchmarks)
* [Fighting regressions with benchmarks in ci](https://medium.com/androiddevelopers/fighting-regressions-with-benchmarks-in-ci-6ea9a14b5c71)

### Steps

Run at least 30 iterations on each side (the tests default to 35). Then from
`android/measure-android/benchmarks/scripts/`, pick the command that matches the test you ran:

```bash
# Startup (pick one of: startupWithBaselineProfile, startupWithoutBaselineProfile, startupFullCompilation)
python main.py compare-startup before.json after.json --test startupWithBaselineProfile

# Click gesture cost
python main.py compare-track-gesture before.json after.json --test ViewClickBenchmark
python main.py compare-track-gesture before.json after.json --test ComposeClickBenchmark

# Click memory
python main.py compare-click-heap before.json after.json --test ViewClickBenchmark
python main.py compare-click-heap before.json after.json --test ComposeClickBenchmark
```

`--test` is a case-insensitive substring matched against the benchmark's `className` or `name`;
it's required because one run produces multiple entries (one per `@Test` method). If the comparison
itself reports an error or warning, see [Benchmark Data Verification](#benchmark-data-verification).

```
Metric                   | Before    | After
--------------------------------------------
Mean                     | 375.721   | 404.902
Standard Deviation       | 11.077    | 12.423
Median                   | 372.874   | 403.175
Variance                 | 122.719   | 154.340
Coefficient of Variation | 0.0294    | 0.030


Metric                                       | Value
----------------------------------------------------
Variance Ratio                               | 1.257
Confidence Level                             | 0.95
Alpha Level                                  | 0.050
Z Score                                      | 1.959
Pooled Estimate of Common Standard Deviation | 11.769
Standard Error                               | 2.813
Error Margin                                 | 5.514
Confidence Interval Range                    | (23.667, 34.696)
Mean Difference                              | 29.181
Confidence Interval of Mean Difference       | (23.667, 34.696)
Confidence Interval of Mean Percent Change   | (6.404, 9.128)
```

### Interpretation

The headline metric is `Confidence Interval of Mean Percent Change`. A negative range means startup
got faster; a positive range means it got slower. `Confidence Interval of Mean Difference` says the
same thing in milliseconds.

> For the above result, we can say with 95% confidence that startup time increased by 5.74%–8.67%,
> or 23.67ms–34.70ms.

# Benchmark Data Verification

`main.py` runs the following checks before comparing, so the comparison is statistically defensible.

## Minimum Number of Iterations

The script errors out if fewer than 30 iterations are present.

## Normality Test

A Shapiro-Wilk test checks whether the data is approximately normally distributed. If it isn't,
the comparison method below isn't valid and the script errors out. To pull the data back toward
normality:

* Use a device with no other apps installed/enabled.
* Keep the device cool.
* Make sure the device has enough battery.
* Run more iterations.

## Coefficient of Variation (CV) test

The script warns if CV exceeds 6%, since the comparison becomes unreliable beyond that.

## Variance Ratio Test (Levene's Test)

The script warns if the two datasets have significantly different variance, which can skew the
result.
