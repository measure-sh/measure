import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import {
  Measure,
  MeasureConfig,
} from '@measuresh/react-native';
import TracesScreen from './TracesScreen';
import ComponentScreen from './ComponentScreen';

export type RootStackParamList = {
  HomeScreen: undefined;
  ComponentScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const initializeMeasure = async () => {
    try {
      const measureConfig = new MeasureConfig({
        enableLogging: true,
        autoStart: true,
        enableFullCollectionMode: false,
      });

      await Measure.init(measureConfig);

      Measure.onShake(() => {
        console.log('Shake detected — launching bug report flow!');
        Measure.launchBugReport(true, { source: 'shake' }, { screen: 'Home' });
      });
    } catch (error) {
      console.error('Failed to initialize Measure:', error);
    }
  };

  useEffect(() => {
    initializeMeasure();
  }, []);

  return (
    <NavigationContainer>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Navigator initialRouteName="HomeScreen">
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
          <Stack.Screen name="ComponentScreen" component={ComponentScreen} />
          <Stack.Screen name="TracesScreen" component={TracesScreen} />
        </Stack.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}