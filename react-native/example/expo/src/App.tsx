import { Text, View, StyleSheet, Button } from 'react-native';
import { multiply, initialize } from '@measure/react-native';
import React from 'react';

const result = multiply(3, 10);

export default function App() {
  const handleInitialize = () => {
    initialize('YOUR_API_KEY')
      .then(() => {
        console.log('Measure SDK initialized');
      })
      .catch((err) => {
        console.error('Initialization failed:', err);
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Measure {result}</Text>
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