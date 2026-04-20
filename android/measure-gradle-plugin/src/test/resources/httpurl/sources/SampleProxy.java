import java.io.IOException;
import java.net.Proxy;
import java.net.URL;

public class SampleProxy {
    public void doRequest() throws IOException {
        new URL("http://x").openConnection((Proxy) null);
    }
}
