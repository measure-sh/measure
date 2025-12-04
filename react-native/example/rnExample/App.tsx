import React, {useEffect} from 'react';
import {
  SectionList,
  SafeAreaView,
  StatusBar,
  Text,
  useColorScheme,
  Pressable,
  StyleSheet,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';
import {Measure, ClientInfo, MeasureConfig, ScreenshotMaskLevel} from '@measuresh/react-native';

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

  const initializeMeasure = () => {
    const clientInfo = new ClientInfo(
      'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
      'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
      'https://api.measure.sh',
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

    Measure.init(clientInfo, measureConfig);
  };

  useEffect(() => {
    initializeMeasure();
  }, []);

  /** === SDK Actions === */
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

  /** === Simulation Helpers === */
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
          onPress: () => trackCustomEvent(),
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
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
});

export default App;
