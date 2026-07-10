# Log visitor test fixtures

Tiny Java classes used by `LogClassVisitorTest` to drive the bytecode rewrite.
Each fixture `.java` source compiles to a single `.class` file checked in next to
this directory:

| Source           | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| LogSample.java   | Every intercepted `Log` variant plus `isLoggable`/`getStackTraceString`, which must stay untouched |
| LogUnrelated.java | A method with no `android.util.Log` calls — visitor must not touch it |

`android/util/Log.java` is a compile-only stub of the framework class; its
`.class` output is not checked in.

## Regenerating the .class files

From this directory:

```sh
javac --release 11 LogSample.java LogUnrelated.java
mv LogSample.class LogUnrelated.class ..
rm -rf android/util/*.class
```

The `--release 11` flag pins the bytecode level so the fixtures don't drift if a
contributor uses a newer JDK locally.
