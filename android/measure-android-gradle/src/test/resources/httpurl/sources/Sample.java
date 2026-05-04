import java.io.IOException;
import java.net.URL;

public class Sample {
    public void doRequest() throws IOException {
        new URL("http://x").openConnection();
    }
}
