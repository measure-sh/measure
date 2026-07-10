import android.util.Log;

public class LogSample {
    public void doLog(Throwable tr) {
        Log.v("t", "m");
        Log.v("t", "m", tr);
        Log.d("t", "m");
        Log.d("t", "m", tr);
        Log.i("t", "m");
        Log.i("t", "m", tr);
        Log.w("t", "m");
        Log.w("t", "m", tr);
        Log.w("t", tr);
        Log.e("t", "m");
        Log.e("t", "m", tr);
        Log.wtf("t", "m");
        Log.wtf("t", tr);
        Log.wtf("t", "m", tr);
        Log.println(Log.INFO, "t", "m");
        Log.isLoggable("t", Log.DEBUG);
        Log.getStackTraceString(tr);
    }
}
