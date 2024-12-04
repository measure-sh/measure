# Benchmarks

* [Running the benchmarks](#running-the-benchmarks)
* [Benchmarks](#benchmarks)
    * [Startup Benchmark](#startup-benchmark)
    * [Target Finder Benchmark](#target-finder-benchmark)
* [Benchmark Comparison](#benchmark-comparison)
    * [Steps](#steps)
    * [Interpretation](#interpretation)
* [Benchmark Data Verification](#benchmark-data-verification)
* [Results](#results)

This directory contains benchmarks for `measure`. There are two projects in this directory:

* `app` - an app with two flavors: `measureDisabled` and `measureEnabled`.
* `benchmark` - this project contains the benchmark tests.

Running the benchmarks with these two flavors allows comparing the impact of adding `measure` to a
project. Benchmark can also be run to compare different versions of Measure.

# Running the benchmarks

Benchmark tests can be run from Android Studio or from the command line. Make sure the tests are run
on a real device for accurate results.

### Using Android Studio

* Select a release build variant with either `measureEnabled` or `measureDisabled`.
* Open the benchmark test to run and click the green arrow to run the test.

### Using Command Line

* Run the following command to run the benchmark tests with measure disabled:

```bash
./gradlew :benchmarks:benchmark:connectedMeasureDisabledBenchmarkAndroidTest
```

or with measure enabled:

```bash
./gradlew :benchmarks:benchmark:connectedMeasureEnabledBenchmarkAndroidTest
```

# Benchmarks

* [Startup Benchmark](#startup-benchmark)
* [Target Finder Benchmark](#target-finder-benchmark)

### Startup Benchmark

This benchmark measures the time taken to launch the app. There are two use-cases for this
benchmark:

* To compare startup time for a project with and without Measure.
* To compare different versions of Measure and detect regressions.

### Target Finder Benchmark

These are two benchmarks (View and Compose) that measures the time added by Measure to find
click/scroll targets. This is used to detect any regressions in target finding logic.

# Benchmark Comparison

These two blogs are a must-read for the topic:

* [Statistically rigorous android macrobenchmarks](https://blog.p-y.wtf/statistically-rigorous-android-macrobenchmarks).
* [Fighting regressions with benchmarks in ci](https://medium.com/androiddevelopers/fighting-regressions-with-benchmarks-in-ci-6ea9a14b5c71)

### Steps

Follow the steps below to compare the benchmark results:

1. Run at least 30 iterations.
2. Run the `scripts/main.py` script with the path to the two benchmark results to compare.

To compare [Startup Benchmark](#startup-benchmark):

```bash
cd android/benchmarks/scripts
python main.py compare-startup path-to-before-benchmarkData.json path-to-after-benchmarkData.json
```

To compare [Target Finder Benchmark](#target-finder-benchmark):

```bash
cd android/benchmarks/scripts
python main.py compare_target_finder path-to-before-benchmarkData.json path-to-after-benchmarkData.json
```

This will print a detailed summary of the comparison in the following format, if the script
produces an error or a warning, refer to the [Data Verification](#data-verification) section below.

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

The most important metric is the `Confidence Interval of Mean Percent Change`
which represents the range of the percent change in the mean. If the range is _negative_, it means
the performance has
_improved_. If the range is _positive_, it means the performance has _degraded_.

The `Confidence Interval of Mean Difference` represents the range of the difference in the mean. If
the range is
negative, it means the performance has improved. If the range is positive, it means the performance
has degraded.

> For the above result, we can say with 95% confidence that the startup time has increased by 5.74%
> to 8.67% or
> between 23.67ms to 34.70ms.

# Benchmark Data Verification

The script runs the following checks to verify the data before comparing the benchmarks to ensure
the comparison is reliable.

## Minimum Number of Iterations

The script checks if the number of iterations is at least 30. If the number of iterations is less
than
30, it will report an _error_.

## Normality Test

The script runs the Shapiro-Wilk test to check if the data is normally distributed. If the data is
normally distributed, it will continue with the comparison. If the data is not normally distributed,
it will report an _error_ as a comparison with this method is not possible. Try the
following ways to eliminate the outliers and make the data normally distributed:

* Use a device with no other apps installed/enabled.
* Ensure the device is placed in a cool place.
* Ensure the device has enough battery.
* Try running more iterations.

## Coefficient of Variation (CV) test

The script runs the Coefficient of Variation (CV) test to check if the data is stable. If the CV is
more than 6% then the data is not stable and the comparison is not going to be reliable. This is
reported as a _warning_.

## Variance Ratio Test or Levene's Test

The script runs the Levene's Test to check if the variance of the two datasets is not significantly
different. If the variance is significantly different, it can lead to unreliable results. This is
reported as a _warning_.

# Results

The raw results of the benchmarks can be found in the [benchmarkData](benchmarkData)
folder. These results are collected manually using a Pixel 4a device running Android 13 (API 33).
