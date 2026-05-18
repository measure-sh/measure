# HttpURLConnection visitor test fixtures

Tiny Java classes used by `HttpUrlConnectionClassVisitorTest` to drive the bytecode
rewrite. Each `.java` source compiles to a single `.class` file checked in next to
this directory:

| Source              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| Sample.java         | `URL.openConnection()` — happy path                        |
| SampleProxy.java    | `URL.openConnection(Proxy)` — proxy overload               |
| SampleStream.java   | `URL.openStream()` — stream overload (replaced, not appended) |
| SampleUnrelated.java | A method with no `URL` calls — visitor must not touch it  |

## Regenerating the .class files

From this directory:

```sh
javac --release 11 *.java
mv *.class ..
```

The `--release 11` flag pins the bytecode level so the fixtures don't drift if a
contributor uses a newer JDK locally.
