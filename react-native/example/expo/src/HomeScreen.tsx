import React, { useState } from 'react';
import {
  SectionList,
  Text,
  View,
  Pressable,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
} from 'react-native';
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

const setUserIdExample = () => {
  Measure.setUserId('sample_user_123');
};

const clearUserIdExample = () => {
  Measure.clearUserId();
};

const trackHttpEventManually = () => {
  const startTime = Measure.getCurrentTime();
  const endTime = startTime + 123;

  Measure.trackHttpEvent({
    url: 'https://api.example.com/test',
    method: 'get',
    startTime,
    endTime,
    statusCode: 200,
    client: 'manual-example',
    requestHeaders: { Accept: 'application/json' },
    responseHeaders: { 'Content-Type': 'application/json' },
    requestBody: null,
    responseBody: '{"result": "success"}',
  })
    .then(() => {
      console.log('Manual HTTP event tracked successfully');
    })
    .catch((err) => {
      console.error('Failed to track manual HTTP event:', err);
    });
};

const trackBugReport = () => {
  Measure.launchBugReport(
    true,
    { theme: 'dark' },
    { userId: '123', screen: 'Home' }
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const captureScreenshot = async () => {
    try {
      const result = await Measure.captureScreenshot();

      const base64 = 'data:image/png;base64,' + result.base64;
      setScreenshot(base64);
      setModalVisible(true);

      console.log('Screenshot captured:', result);
    } catch (e) {
      console.error('Failed to capture screenshot:', e);
    }
  };

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
        {
          id: 'event',
          title: 'Track Custom Event',
          onPress: trackCustomEvent,
        },
        {
          id: 'track-http',
          title: 'Track HTTP Event Manually',
          onPress: trackHttpEventManually,
        },
        {
          id: 'set-user',
          title: 'Set User ID',
          onPress: setUserIdExample,
        },
        {
          id: 'clear-user',
          title: 'Clear User ID',
          onPress: clearUserIdExample,
        },
        {
          id: 'bugReport',
          title: 'Track Bug Report',
          onPress: trackBugReport,
        },
        {
          id: 'screenshot',
          title: 'Capture Screenshot',
          onPress: captureScreenshot,
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
    {
      title: 'Navigation',
      data: [
        {
          id: 'navigate',
          title: 'Component Screen',
          onPress: navigateToComponentScreen,
        },
        {
          id: 'navigate-traces',
          title: 'Traces Screen',
          onPress: navigateToTracesScreen,
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      {/* Screenshot Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {screenshot && (
              <Image
                source={{ uri: screenshot }}
                style={styles.screenshotImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main UI */}
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

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  screenshotImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});