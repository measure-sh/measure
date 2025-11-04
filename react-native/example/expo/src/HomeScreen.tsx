import React from 'react';
import { SectionList, Text, View, Pressable, StyleSheet } from 'react-native';
import { Measure } from '@measuresh/react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './AppNavigator';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

const stopMeasure = () => {
  Measure.stop()
    .then(() => console.log('Measure SDK stopped successfully'))
    .catch((error) => console.error('Failed to stop Measure SDK:', error));
};

const startMeasure = () => {
  Measure.start()
    .then(() => console.log('Measure SDK started successfully'))
    .catch((error) => console.error('Failed to start Measure SDK:', error));
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

const trackCustomEvent = () => {
  Measure.trackEvent('button_click', {
    screen: 'Home',
    action: 'Track Custom Event',
    timestamped: true,
  });
  console.log('Custom event tracked: button_click');
};

const callGetApi = async () => {
  try {
    console.log('Calling GET API (fetch)...');
    const response = await fetch('https://api.agify.io?name=adwin');
    const json = await response.json();
    console.log('GET API response:', json);
  } catch (error) {
    console.error('GET API error:', error);
  }
};

const callPostApi = async () => {
  try {
    console.log('Calling POST API (fetch)...');
    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world', timestamp: Date.now() }),
    });
    const json = await response.json();
    console.log('POST API response:', json);
  } catch (error) {
    console.error('POST API error:', error);
  }
};

const callGetApiXHR = () => {
  console.log('Calling GET API (XHR)...');
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://api.agify.io?name=aparna');
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      console.log('GET XHR response:', xhr.responseText);
    }
  };
  xhr.onerror = (error) => {
    console.error('GET XHR error:', error);
  };
  xhr.send();
};

const callPostApiXHR = () => {
  console.log('Calling POST API (XHR)...');
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://httpbin.org/post');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      console.log('POST XHR response:', xhr.responseText);
    }
  };
  xhr.onerror = (error) => {
    console.error('POST XHR error:', error);
  };
  const body = JSON.stringify({ hello: 'world', timestamp: Date.now() });
  xhr.send(body);
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const navigateToComponentScreen = () => {
    navigation.navigate('ComponentScreen');
  };

  const navigateToTracesScreen = () => {
    navigation.navigate('TracesScreen');
  };

  const sections = [
    {
      title: 'Session & Init',
      data: [
        { id: 'start', title: 'Start SDK', onPress: startMeasure },
        { id: 'stop', title: 'Stop SDK', onPress: stopMeasure },
      ],
    },
    {
      title: 'User Actions',
      data: [
        { id: 'event', title: 'Track Custom Event', onPress: trackCustomEvent },
        { id: 'get-api', title: 'Call GET API (fetch)', onPress: callGetApi },
        { id: 'post-api', title: 'Call POST API (fetch)', onPress: callPostApi },
        { id: 'get-api-xhr', title: 'Call GET API (XHR)', onPress: callGetApiXHR },
        { id: 'post-api-xhr', title: 'Call POST API (XHR)', onPress: callPostApiXHR },
      ],
    },
    {
      title: 'Crash & Exception Simulation',
      data: [
        { id: 'js-exception', title: 'Throw JS Exception', onPress: simulateJSException },
        { id: 'unhandled-rejection', title: 'Unhandled Promise Rejection', onPress: simulateUnhandledPromiseRejection },
        { id: 'native-crash', title: 'Trigger Native Crash', onPress: simulateNativeCrash },
        { id: 'infinite-loop', title: 'UI Freeze (Infinite Loop)', onPress: simulateInfiniteLoop },
      ],
    },
    {
      title: 'Navigation',
      data: [
        { id: 'navigate', title: 'Component Screen', onPress: navigateToComponentScreen },
        { id: 'navigate-traces', title: 'Traces Screen', onPress: navigateToTracesScreen },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.item} onPress={item.onPress}>
            <Text style={styles.itemText}>{item.title}</Text>
          </Pressable>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    color: '#333',
  },
  item: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  itemText: {
    color: '#1e1e1e',
    fontSize: 16,
    textAlign: 'left',
  },
});
