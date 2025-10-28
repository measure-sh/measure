import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import ComponentScreen from './ComponentScreen'; // Create this screen if not already
import {
  Measure,
  ClientInfo,
  MeasureConfig,
} from '@measuresh/react-native';
import TracesScreen from './TracesScreen';

export type RootStackParamList = {
  HomeScreen: undefined;
  ComponentScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const initializeMeasure = async () => {
    try {
      const clientInfo = new ClientInfo(
        'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
        'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
        'https://api.measure.sh'
      );

      
      const measureConfig = new MeasureConfig(
        true, // enableLogging
        1.0, // samplingRateForErrorFreeSessions
        1.0, // traceSamplingRate
        false, // trackHttpHeaders
        false, // trackHttpBody
        [], // httpHeadersBlocklist
        [], // httpUrlBlocklist
        [], // httpUrlAllowlist
        true, // autoStart
        true // trackViewControllerLoadTime
      );

      // Initialize Measure SDK
      Measure.init(clientInfo, measureConfig);
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
