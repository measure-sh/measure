import { Text, View, StyleSheet, Button, Alert } from 'react-native';
import { initialize } from '@measuresh/react-native';
import React from 'react';

export default function App() {
  const handleInitialize = async () => {
    try {
      const message = await initialize('msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c');
      console.log('✅ Measure SDK initialized:', message);
      Alert.alert('Success', `Measure SDK initialized:\n${message}`);
    } catch (err) {
      console.error('❌ Failed to initialize Measure SDK:', err);
      Alert.alert('Error', 'Failed to initialize Measure SDK');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Measure</Text>
      <Button title="Initialize SDK" onPress={handleInitialize} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
});