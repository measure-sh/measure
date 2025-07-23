/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { multiply } from '@measure/react-native';

const result = multiply(3, 10);

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <><View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NewAppScreen templateFileName="App.tsx" />
    </View><View style={styles.container1}>
        <Text>Result: {result}</Text>
      </View></>
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
