import java.io.IOException;
import java.net.URL;

public class SampleStream {
    public void doRequest() throws IOException {
        new URL("http://x").openStream();
    }
}
