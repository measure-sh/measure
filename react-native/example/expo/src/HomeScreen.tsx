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
    .then(() => {
      console.log('Measure SDK stopped successfully');
    })
    .catch((error) => {
      console.error('Failed to stop Measure SDK:', error);
    });
};

const startMeasure = () => {
  Measure.start()
    .then(() => {
      console.log('Measure SDK started successfully');
    })
    .catch((error) => {
      console.error('Failed to start Measure SDK:', error);
    });
};

const simulateJSException = () => {
  throw new Error('Simulated JavaScript exception');
};

const simulateUnhandledPromiseRejection = () => {
  Promise.reject(new Error('Simulated unhandled promise rejection'));
};

const simulateNativeCrash = () => {
  // Intentionally call something invalid to crash native bridge
  // (you’ll only see this on device/emulator, not in web preview)
  // @ts-ignore
  Measure.triggerNativeCrash();
};

const simulateInfiniteLoop = () => {
  while (true) {}
};

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const navigateToComponentScreen = () => {
    navigation.navigate('ComponentScreen');
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
          onPress: () => console.log('Event pressed'),
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
          title: 'Navigate to Component Screen',
          onPress: navigateToComponentScreen,
        },
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