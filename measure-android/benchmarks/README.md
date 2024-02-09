# Benchmarks

This directory contains benchmarks for `measure`. There are two projects in this directory:

* `app` - an app with two flavors: `measureDisabled` and `measureEnabled`.
* `benchmark` - this project contains the benchmark tests.

Running the benchmarks with these two flavors allows comparing the impact of adding `measure` to a
project.

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

# Interpreting Startup Benchmark results

Automating interpretation of benchmark results requires a lot of work as described in
the following blogs, for now, the results can be interpreted manually.

1. [Statistically rigorous android macrobenchmarks](https://blog.p-y.wtf/statistically-rigorous-android-macrobenchmarks).
2. [Fighting regressions with benchmarks in ci](https://medium.com/androiddevelopers/fighting-regressions-with-benchmarks-in-ci-6ea9a14b5c71)

## Manually interpreting the results

1. Run at least 30 iterations for each benchmark.
2. Run Shapiro Wilk test to check if the benchmark results are normally distributed
   using [shapirowilk.py](scripts/shapirowilk.py).

Run the [shapirowilk.py](scripts/shapirowilk.py) script along with the path to the benchmark data, which is stored
under `/build/outputs/connected_android_test_additional_output/<device_name>/...` after the benchmark is complete. Run
this script for both benchmark results that need to be compared.

```bash
python shapirowilk.py path-to-benchmarkData.json
```

Based on the result follow the instructions below:

* [Data is normally distributed](#data-is-normally-distributed)
* [Data is not normally distributed](#data-is-not-normally-distributed)

### Data is Normally Distributed

3. If the data is normally distributed, run the [compare.py](scripts/compare.py) script.

```bash
python compare.py before-benchmarkData1.json after-benchmarkData2.json
```

This will print a summary of the comparison in the following format:

```
Metric                   | Before               | After
----------------------------------------------------------------------
Mean                     | 404.90279785714284   | 375.72114460000006
Standard Deviation       | 12.42337257721407    | 11.077901418326125
Median                   | 403.175249           | 372.874308
Variance                 | 154.3401861922746    | 122.71989983415196
Coefficient of Variation | 0.030682357946060095 | 0.029484370463418744


Metric                                       | Value
----------------------------------------------------------------------------------------
Variance Ratio                               | 0.7951260320579725
Confidence Level                             | 0.95
Alpha Level                                  | 0.050000000000000044
Z Score                                      | 1.959963984540054
Pooled Estimate of Common Standard Deviation | 11.769878632051109
Standard Error                               | 2.813539133884208
Error Margin                                 | 5.514435371507065
Confidence Interval Range                    | (-34.696088628649846, -23.66721788563572)
Mean Difference                              | -29.181653257142784
Confidence Interval of Mean Difference       | (-34.696088628649846, -23.66721788563572)
Confidence Interval of Mean Percent Change   | (-8.674769867143537, -5.739382572197526)
```

You don't need to know all the details, but the most important part is the `Confidence Interval of Mean Percent Change`
which tells you the range of the percent change in the mean. If the range is negative, it means the performance has
improved. If the range is positive, it means the performance has degraded.

The `Confidence Interval of Mean Difference` tells you the range of the difference in the mean. If the range is
negative, it means the performance has improved. If the range is positive, it means the performance has degraded.

> For the above result, you can say with 95% confidence that the startup time has increased by 5.74% to 8.67% or
> between 23.67ms to 34.70ms.

### Data is not Normally Distributed

If the data is not normally distributed, comparison with this method is not possible. You can try the following to
eliminate the outliers and make the data normally distributed:

* Use a device with no other apps installed/enabled.
* Ensure the device is placed in a cool place.
* Ensure the device has enough battery.
* Try running more iterations.