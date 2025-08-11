import React, {useEffect} from 'react';
import {
  Alert,
  SectionList,
  SafeAreaView,
  StatusBar,
  Text,
  View,
  useColorScheme,
  Pressable,
  StyleSheet,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';
import {Measure, ClientInfo, BaseMeasureConfig} from '@measuresh/react-native';

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
      'https://api.measure.sh',
    );

    const measureConfig = new BaseMeasureConfig(
      true, // enableLogging
      0.7, // samplingRateForErrorFreeSessions
      0.1, // traceSamplingRate
      false, // trackHttpHeaders
      false, // trackHttpBody
      [], // httpHeadersBlocklist
      [], // httpUrlBlocklist
      [], // httpUrlAllowlist
      false, // autoStart
      true, // trackViewControllerLoadTime
    );

    Measure.init(clientInfo, measureConfig);
  };

  useEffect(() => {
    initializeMeasure();
  }, []);

  const sections = [
    {
      title: 'Session & Init',
      data: [
        {
          id: 'start',
          title: 'Start SDK',
          onPress: () => startMeasure(),
        },
        {
          id: 'stop',
          title: 'Stop SDK',
          onPress: () => stopMeasure(),
        },
      ],
    },
    {
      title: 'User Actions',
      data: [
        {
          id: 'event',
          title: 'Track Custom Event',
          onPress: () => console.log('Track event'),
        },
        {
          id: 'crash',
          title: 'Simulate Crash',
          onPress: () => console.log('Simulate crash'),
        },
      ],
    },
  ];

  const stopMeasure = () => {
    Measure.stop();
  };

  const startMeasure = () => {
    Measure.start();
  };

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
