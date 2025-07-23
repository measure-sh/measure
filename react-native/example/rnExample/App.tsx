/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import {
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  Alert,
} from 'react-native';
import { multiply, initialize } from '@measure/react-native';

const result = multiply(3, 10);

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const handleInitialize = async () => {
    try {
      const message = await initialize('dummy-api-key-10000');
      console.log('✅ Measure SDK initialized:', message);
      Alert.alert('Success', `Measure SDK initialized:\n${message}`);
    } catch (err) {
      console.error('❌ Failed to initialize Measure SDK:', err);
      Alert.alert('Error', 'Failed to initialize Measure SDK');
    }
  };

  return (
    <>
      <View style={styles.container}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <NewAppScreen templateFileName="App.tsx" />
      </View>
      <View style={styles.container1}>
        <Text>Result: {result}</Text>
        <Button title="Initialize SDK" onPress={handleInitialize} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 8,
  },
  container1: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;