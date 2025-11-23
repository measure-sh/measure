import React, {useEffect, useState} from 'react';
import {
  SectionList,
  SafeAreaView,
  StatusBar,
  Text,
  useColorScheme,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';
import {
  Measure,
  ClientInfo,
  MeasureConfig,
  ScreenshotMaskLevel,
} from '@measuresh/react-native';

type ActionItem = {
  id: string;
  title: string;
  onPress: () => void;
};

const App = (): React.JSX.Element => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundColor = isDarkMode ? Colors.darker : Colors.lighter;
  const contentBackgroundColor = isDarkMode ? Colors.black : Colors.white;
  const textColor = isDarkMode ? Colors.white : Colors.black;

  // Screenshot state
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const initializeMeasure = async () => {
    const clientInfo = new ClientInfo(
      'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
      'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
      'http://localhost:8080',
    );

    const measureConfig = new MeasureConfig({
      enableLogging: true,
      samplingRateForErrorFreeSessions: 1.0,
      coldLaunchSamplingRate: 1.0,
      warmLaunchSamplingRate: 1.0,
      hotLaunchSamplingRate: 1.0,
      userJourneysSamplingRate: 1.0,
      traceSamplingRate: 1.0,
      trackHttpHeaders: true,
      trackHttpBody: true,
      httpHeadersBlocklist: [],
      httpUrlBlocklist: [],
      httpUrlAllowlist: [],
      autoStart: true,
      screenshotMaskLevel: ScreenshotMaskLevel.allText,
      maxDiskUsageInMb: 50,
    });

    await Measure.init(clientInfo, measureConfig);

    Measure.onShake(() => {
      console.log('Shake detected — launching bug report flow!');
      Measure.launchBugReport(true, { source: 'shake' }, { screen: 'Home' });
    });
  };

  useEffect(() => {
    initializeMeasure();
  }, []);

  const startMeasure = () => {
    Measure.start()
      .then(() => console.log('Measure SDK started successfully'))
      .catch((error: any) =>
        console.error('Failed to start Measure SDK:', error),
      );
  };

  const stopMeasure = () => {
    Measure.stop()
      .then(() => console.log('Measure SDK stopped successfully'))
      .catch((error: any) =>
        console.error('Failed to stop Measure SDK:', error),
      );
  };

  const trackCustomEvent = () => {
    Measure.trackEvent('button_click', {
      screen: 'Home',
      action: 'Track Custom Event',
      timestamped: true,
    });
  };

  const trackHttpEventManually = () => {
    const startTime = Date.now();
    const endTime = startTime + 180;

    Measure.trackHttpEvent({
      url: 'https://api.example.com/manual',
      method: 'post',
      startTime,
      endTime,
      statusCode: 201,
      client: 'manual-test',
      requestHeaders: {
        'Content-Type': 'application/json',
      },
      responseHeaders: {
        'Content-Type': 'application/json',
      },
      requestBody: JSON.stringify({hello: 'world'}),
      responseBody: JSON.stringify({success: true}),
    })
      .then(() => console.log('Manual HTTP Event Tracked'))
      .catch(err => console.error('Failed to track HTTP event:', err));
  };

  /** === Simulation Helpers === */
  const launchBugReport = () => {
    console.log('Launching bug report flow manually');
    Measure.launchBugReport(true, { source: 'manual' }, { screen: 'Home' });
  };

  const captureScreenshot = async () => {
    try {
      const attachment = await Measure.captureScreenshot();

      if (attachment?.path) {
        const path = attachment.path.startsWith('file://')
          ? attachment.path
          : `file://${attachment.path}`;

        setScreenshotPath(path);
        setShowScreenshot(true);
      }

      console.log('Screenshot captured:', attachment);
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  };

  const simulateJSException = () => {
    throw new Error('Simulated JavaScript exception');
  };

  const simulateUnhandledPromiseRejection = () => {
    Promise.reject(new Error('Simulated unhandled promise rejection'));
  };

  const simulateNativeCrash = () => {
    // @ts-ignore
    Measure.triggerNativeCrash();
  };

  const simulateInfiniteLoop = () => {
    while (true) {}
  };

  const testFetchApi = async () => {
    try {
      console.log('Making fetch API call...');
      const response = await fetch(
        'https://jsonplaceholder.typicode.com/posts/1',
      );
      const json = await response.json();
      console.log('Fetch response:', json);
    } catch (e) {
      console.error('Fetch API call failed:', e);
    }
  };

  const testXhrApi = () => {
    console.log('Making XHR API call...');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.github.com/repos/facebook/react-native', true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        console.log('XHR status:', xhr.status);
        console.log('XHR status:', xhr.getResponseHeader('Content-Type'));
        console.log('XHR response:', xhr.responseText);
      }
    };

    xhr.send();
  };

  /** === UI Sections === */
  const sections = [
    {
      title: 'Session & Init',
      data: [
        {id: 'start', title: 'Start SDK', onPress: startMeasure},
        {id: 'stop', title: 'Stop SDK', onPress: stopMeasure},
      ],
    },
    {
      title: 'User Actions',
      data: [
        {
          id: 'event',
          title: 'Track Custom Event',
          onPress: trackCustomEvent,
        },
        {
          id: 'bug-report',
          title: 'Open Bug Report',
          onPress: launchBugReport,
        },
        {
          id: 'track-http',
          title: 'Track HTTP Event Manually',
          onPress: trackHttpEventManually,
        },
      ],
    },
    {
      title: 'HTTP Tests',
      data: [
        {
          id: 'fetch-test',
          title: 'Test Fetch API Call',
          onPress: testFetchApi,
        },
        {
          id: 'xhr-test',
          title: 'Test XHR API Call',
          onPress: testXhrApi,
        },
        {
          id: 'screenshot',
          title: 'Capture Screenshot',
          onPress: captureScreenshot,
        },
        {
          id: 'crash',
          title: 'Simulate Crash',
          onPress: () => console.log('Simulate crash'),
        },
      ],
    },
    {
      title: 'Crash & Exception Simulation',
      data: [
        {
          id: 'js-exception',
          title: 'Throw JS Exception',
          onPress: simulateJSException,
        },
        {
          id: 'unhandled-rejection',
          title: 'Unhandled Promise Rejection',
          onPress: simulateUnhandledPromiseRejection,
        },
        {
          id: 'native-crash',
          title: 'Trigger Native Crash',
          onPress: simulateNativeCrash,
        },
        {
          id: 'infinite-loop',
          title: 'UI Freeze (Infinite Loop)',
          onPress: simulateInfiniteLoop,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor}]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />

      <Text style={styles.title}>Measure SDK Actions</Text>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.content,
          {backgroundColor: contentBackgroundColor},
        ]}
        renderItem={({item}) => (
          <Pressable style={styles.item} onPress={item.onPress}>
            <Text style={styles.itemText}>{item.title}</Text>
          </Pressable>
        )}
        renderSectionHeader={({section: {title}}) => (
          <Text style={[styles.sectionHeader, {color: textColor}]}>
            {title}
          </Text>
        )}
      />

      {/* Screenshot Popup */}
      {showScreenshot && screenshotPath && (
        <Pressable
          style={styles.screenshotOverlay}
          onPress={() => setShowScreenshot(false)}
        >
          <Image
            source={{ uri: screenshotPath }}
            style={styles.screenshotImage}
            resizeMode="contain"
          />
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginVertical: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  item: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  itemText: {
    color: '#1e1e1e',
    fontSize: 16,
    textAlign: 'left',
  },
  screenshotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
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

export default App;