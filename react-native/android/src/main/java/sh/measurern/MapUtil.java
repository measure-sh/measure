/*
  MapUtil exposes a set of helper methods for working with
  ReadableMap (by React Native), Map<String, Object>, and JSONObject.

  This code was adapted from the https://gist.github.com/mfmendiola/dbaee8be5b0bb2fcbd80293657fc29ba
 */

package sh.measure.rn;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;

import java.util.Map;
import java.util.HashMap;
import java.util.Iterator;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

import sh.measure.rn.MapUtil;

public class MapUtil {

  public static JSONObject toJSONObject(ReadableMap readableMap) throws JSONException {
    JSONObject jsonObject = new JSONObject();

    ReadableMapKeySetIterator iterator = readableMap.keySetIterator();

    while (iterator.hasNextKey()) {
      String key = iterator.nextKey();
      ReadableType type = readableMap.getType(key);

      switch (type) {
        case Null:
          jsonObject.put(key, null);
          break;
        case Boolean:
          jsonObject.put(key, readableMap.getBoolean(key));
          break;
        case Number:
          jsonObject.put(key, readableMap.getDouble(key));
          break;
        case String:
          jsonObject.put(key, readableMap.getString(key));
          break;
        case Map:
          jsonObject.put(key, MapUtil.toJSONObject(readableMap.getMap(key)));
          break;
        case Array:
          jsonObject.put(key, ArrayUtil.toJSONArray(readableMap.getArray(key)));
          break;
      }
    }

    return jsonObject;
  }

  public static Map<String, Object> toMap(JSONObject jsonObject) throws JSONException {
    Map<String, Object> map = new HashMap<>();
    Iterator<String> iterator = jsonObject.keys();

    while (iterator.hasNext()) {
      String key = iterator.next();
      Object value = jsonObject.get(key);

      if (value instanceof JSONObject) {
        value = MapUtil.toMap((JSONObject) value);
      }
      if (value instanceof JSONArray) {
        value = ArrayUtil.toArray((JSONArray) value);
      }

      map.put(key, value);
    }

    return map;
  }

  public static Map<String, Object> toMap(ReadableMap readableMap) {
    Map<String, Object> map = new HashMap<>();
    ReadableMapKeySetIterator iterator = readableMap.keySetIterator();

    while (iterator.hasNextKey()) {
      String key = iterator.nextKey();
      ReadableType type = readableMap.getType(key);

      switch (type) {
        case Null:
          map.put(key, null);
          break;
        case Boolean:
          map.put(key, readableMap.getBoolean(key));
          break;
        case Number:
          map.put(key, readableMap.getDouble(key));
          break;
        case String:
          map.put(key, readableMap.getString(key));
          break;
        case Map:
          map.put(key, MapUtil.toMap(readableMap.getMap(key)));
          break;
        case Array:
          map.put(key, ArrayUtil.toArray(readableMap.getArray(key)));
          break;
      }
    }

    return map;
  }

  public static WritableMap toWritableMap(Map<String, Object> map) {
    WritableMap writableMap = Arguments.createMap();
    Iterator iterator = map.entrySet().iterator();

    while (iterator.hasNext()) {
      Map.Entry pair = (Map.Entry)iterator.next();
      Object value = pair.getValue();

      if (value == null) {
        writableMap.putNull((String) pair.getKey());
      } else if (value instanceof Boolean) {
        writableMap.putBoolean((String) pair.getKey(), (Boolean) value);
      } else if (value instanceof Double) {
        writableMap.putDouble((String) pair.getKey(), (Double) value);
      } else if (value instanceof Integer) {
        writableMap.putInt((String) pair.getKey(), (Integer) value);
      } else if (value instanceof String) {
        writableMap.putString((String) pair.getKey(), (String) value);
      } else if (value instanceof Map) {
        writableMap.putMap((String) pair.getKey(), MapUtil.toWritableMap((Map<String, Object>) value));
      } else if (value.getClass() != null && value.getClass().isArray()) {
        writableMap.putArray((String) pair.getKey(), ArrayUtil.toWritableArray((Object[]) value));
      }

      iterator.remove();
    }

    return writableMap;
  }

  public static Map<String, String> toStringMap(JSONObject jsonObject) throws JSONException {
    Map<String, String> map = new HashMap<>();
    Iterator<String> iterator = jsonObject.keys();

    while (iterator.hasNext()) {
        String key = iterator.next();
        Object value = jsonObject.get(key);

        // Only allow primitive string values (safely convert others to string)
        if (value != null) {
        map.put(key, value.toString());
        } else {
        map.put(key, null);
        }
    }

    return map;
   }
}