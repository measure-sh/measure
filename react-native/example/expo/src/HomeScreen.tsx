import React from 'react';
import {
  SectionList,
  Text,
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Measure } from '@measuresh/react-native';

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
        onPress: () => console.log('Event pressed'),
      },
      {
        id: 'crash',
        title: 'Simulate Crash',
        onPress: () => console.log('Crash pressed'),
      },
    ],
  },
];

const stopMeasure = () => {
  Measure.stop();
}

const startMeasure = () => {
  Measure.start();
};

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Measure SDK Actions</Text>
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginVertical: 16,
    textAlign: 'center',
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