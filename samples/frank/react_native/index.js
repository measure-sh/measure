import React, {useEffect, useState} from 'react';
import {
  AppRegistry,
  BackHandler,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  SectionList,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {Measure, MeasureConfig} from '@measuresh/react-native';

const lightColors = {
  background: '#FAFAFA',
  surface: 'rgba(255, 255, 255, 0.6)',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  primary: '#2E7D32',
  onPrimary: '#FFFFFF',
  toolbar: '#F1F1F1',
};

const darkColors = {
  background: '#121212',
  surface: 'rgba(30, 30, 30, 0.6)',
  onSurface: '#E6E1E5',
  onSurfaceVariant: '#CAC4D0',
  primary: '#66BB6A',
  onPrimary: '#003909',
  toolbar: '#1E1E1E',
};

// -- Crash actions --

const throwJSException = () => {
  throw new Error('Simulated JavaScript exception');
};

const throwUnhandledRejection = () => {
  Promise.reject(new Error('Simulated unhandled promise rejection'));
};

const triggerNativeCrash = () => {
  // @ts-ignore
  Measure.triggerNativeCrash();
};

const triggerUIFreeze = () => {
  while (true) {}
};

// -- Bug report actions --

const launchBugReport = () => {
  Measure.launchBugReport(true, {source: 'manual'}, {screen: 'RNDemos'});
};

const trackBugReport = async () => {
  try {
    const screenshot = await Measure.captureScreenshot();
    const layoutSnapshot = await Measure.captureLayoutSnapshot();
    const attachments = [screenshot, layoutSnapshot].filter(a => a !== null);
    await Measure.trackBugReport(
      'Bug report from React Native demos',
      attachments,
      {source: 'rn_demo', screen: 'RNDemos'},
    );
  } catch (err) {
    console.error('Failed to send bug report:', err);
  }
};

// -- HTTP actions --

const testFetchGet = async () => {
  try {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts/1',
    );
    await response.json();
  } catch (e) {
  }
};

const testXhrGet = () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.github.com/repos/facebook/react-native', true);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
    }
  };
  xhr.send();
};

const trackHttpManually = () => {
  const startTime = Date.now();
  const endTime = startTime + 180;
  Measure.trackHttpEvent({
    url: 'https://api.example.com/manual',
    method: 'post',
    startTime,
    endTime,
    statusCode: 201,
    client: 'manual-test',
    requestHeaders: {'Content-Type': 'application/json'},
    responseHeaders: {'Content-Type': 'application/json'},
    requestBody: JSON.stringify({hello: 'world'}),
    responseBody: JSON.stringify({success: true}),
  })
    .catch(err => console.error('Failed to track HTTP event:', err));
};

// -- Misc actions --

const trackCustomEvent = () => {
  Measure.trackEvent('button_click', {
    screen: 'RNDemos',
    action: 'Track Custom Event',
  });
};

const createSpan = () => {
  const span = Measure.startSpan('load-data');
  span.setCheckpoint('on-start');
  span.setAttribute('is_premium', false);
  span.setStatus(2); // SpanStatus.Error
  setTimeout(() => {
    span.setCheckpoint('on-complete');
    span.setStatus(1); // SpanStatus.Ok
    span.end();
  }, 2000);
};

const setUserId = () => {
  Measure.setUserId('user-131351');
};

const clearUserId = () => {
  Measure.clearUserId();
};

// -- Component --

const ReactNativeScreen = () => {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [screenshotPath, setScreenshotPath] = useState(null);

  useEffect(() => {
    return () => {
      Measure.onShake(null);
    };
  }, []);

  const toggleShake = enabled => {
    setShakeEnabled(enabled);
    if (enabled) {
      Measure.onShake(() => {
        Measure.launchBugReport(true, {source: 'shake'}, {screen: 'RNDemos'});
      });
    } else {
      Measure.onShake(null);
    }
  };

  const captureScreenshot = async () => {
    try {
      const result = await Measure.captureScreenshot();
      if (!result) return;
      if (result.path) {
        const uri = result.path.startsWith('file://')
          ? result.path
          : `file://${result.path}`;
        setScreenshotPath(uri);
      } else if (result.bytes) {
        setScreenshotPath(`data:image/png;base64,${result.bytes}`);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  };

  const sections = [
    {
      title: 'Crashes',
      data: [
        {
          id: 'js-exception',
          title: 'Throw JS Exception',
          description: 'Throws an uncaught Error',
          onPress: throwJSException,
        },
        {
          id: 'unhandled-rejection',
          title: 'Unhandled Promise Rejection',
          description: 'Rejects a promise without catching',
          onPress: throwUnhandledRejection,
        },
        {
          id: 'native-crash',
          title: 'Native Crash',
          description: 'Triggers a native crash via Measure SDK',
          onPress: triggerNativeCrash,
        },
        {
          id: 'ui-freeze',
          title: 'UI Freeze',
          description: 'Blocks the JS thread forever',
          onPress: triggerUIFreeze,
        },
      ],
    },
    {
      title: 'Bug Reports',
      data: [
        {
          id: 'launch-bug-report',
          title: 'Launch Bug Report',
          description: 'Opens interactive bug report UI',
          onPress: launchBugReport,
        },
        {
          id: 'track-bug-report',
          title: 'Track Bug Report',
          description: 'Captures screenshot and submits report',
          onPress: trackBugReport,
        },
      ],
    },
    {
      title: 'HTTP',
      data: [
        {
          id: 'fetch-get',
          title: 'Fetch GET',
          description: 'GET request via Fetch API',
          onPress: testFetchGet,
        },
        {
          id: 'xhr-get',
          title: 'XHR GET',
          description: 'GET request via XMLHttpRequest',
          onPress: testXhrGet,
        },
        {
          id: 'track-http',
          title: 'Track HTTP Manually',
          description: 'Tracks a synthetic HTTP event',
          onPress: trackHttpManually,
        },
      ],
    },
    {
      title: 'Misc',
      data: [
        {
          id: 'custom-event',
          title: 'Custom Event',
          description: 'Tracks an event with attributes',
          onPress: trackCustomEvent,
        },
        {
          id: 'create-span',
          title: 'Create Span',
          description: 'Span with checkpoints and attributes',
          onPress: createSpan,
        },
        {
          id: 'screenshot',
          title: 'Capture Screenshot',
          description: 'Takes a screenshot and displays it',
          onPress: captureScreenshot,
        },
        {
          id: 'set-user',
          title: 'Set User ID',
          description: 'Sets a dummy user ID on the SDK',
          onPress: setUserId,
        },
        {
          id: 'clear-user',
          title: 'Clear User ID',
          description: 'Clears the current user ID',
          onPress: clearUserId,
        },
      ],
    },
  ];

  const renderItem = ({item, section}) => {
    return (
      <Pressable
        style={({pressed}) => [
          styles.card,
          {backgroundColor: colors.surface},
          pressed && {opacity: 0.6},
        ]}
        android_ripple={{color: colors.onSurfaceVariant, borderless: false}}
        onPress={item.onPress}>
        <Text style={[styles.cardTitle, {color: colors.onSurface}]}>
          {item.title}
        </Text>
        <Text
          style={[styles.cardDescription, {color: colors.onSurfaceVariant}]}>
          {item.description}
        </Text>
      </Pressable>
    );
  };

  const renderSectionHeader = ({section}) => {
    return (
      <Text
        style={[styles.sectionHeader, {color: colors.onSurfaceVariant}]}>
        {section.title}
      </Text>
    );
  };

  const renderSectionFooter = ({section}) => {
    if (section.title !== 'Bug Reports') return null;
    return (
      <View style={[styles.card, {backgroundColor: colors.surface}]}>
        <View style={styles.shakeRow}>
          <View style={styles.shakeText}>
            <Text style={[styles.cardTitle, {color: colors.onSurface}]}>
              Shake to Report
            </Text>
            <Text
              style={[
                styles.cardDescription,
                {color: colors.onSurfaceVariant},
              ]}>
              Shake device to open bug report
            </Text>
          </View>
          <Switch
            value={shakeEnabled}
            onValueChange={toggleShake}
            trackColor={{false: '#767577', true: colors.primary}}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      {Platform.OS === 'android' && (
        <View style={[styles.toolbar, {backgroundColor: colors.toolbar}]}>
          <Pressable
            onPress={() => BackHandler.exitApp()}
            style={styles.backButton}
            android_ripple={{color: colors.onSurfaceVariant, borderless: true, radius: 20}}>
            <Text style={[styles.backArrow, {color: colors.onSurface}]}>
              {'‹'}
            </Text>
          </Pressable>
          <Text style={[styles.toolbarTitle, {color: colors.onSurface}]}>
            React Native Demos
          </Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
      />
      {screenshotPath && (
        <Pressable
          style={styles.screenshotOverlay}
          onPress={() => setScreenshotPath(null)}>
          <Image
            source={{uri: screenshotPath}}
            style={styles.screenshotImage}
            resizeMode="contain"
          />
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: (StatusBar.currentHeight || 0) + 4,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  backButton: {
    padding: 12,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  toolbarTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  shakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shakeText: {
    flex: 1,
  },
  screenshotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  screenshotImage: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
});

const measureReady = Measure.init(
  new MeasureConfig({
    enableLogging: true,
    enableFullCollectionMode: true,
    enableDiagnosticMode: true,
  }),
);

AppRegistry.registerComponent('FrankensteinRN', () => ReactNativeScreen);
