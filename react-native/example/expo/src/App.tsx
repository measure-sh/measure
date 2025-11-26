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
  ScreenshotMaskLevel,
} from '@measuresh/react-native';
import TracesScreen from './TracesScreen';
import { Screen } from 'react-native-screens';

export type RootStackParamList = {
  HomeScreen: undefined;
  ComponentScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const initializeMeasure = async () => {
    try {
      const clientInfo = new ClientInfo(
        'msrsh_3533778aec068f99683da...',
        'msrsh_78e21553fc5ddaf2a3043...',
        'https://localhost:8080'
      );

      const measureConfig = new MeasureConfig({
        enableLogging: true,
        samplingRateForErrorFreeSessions: 1.0,
        coldLaunchSamplingRate: 1.0,
        warmLaunchSamplingRate: 1.0,
        hotLaunchSamplingRate: 1.0,
        userJourneysSamplingRate: 1.0,
        traceSamplingRate: 1.0,
        trackHttpHeaders: true,
        trackHttpBody: true,
        httpHeadersBlocklist: [],
        httpUrlBlocklist: [],
        httpUrlAllowlist: [],
        autoStart: true,
        screenshotMaskLevel: ScreenshotMaskLevel.allText,
        maxDiskUsageInMb: 50,
      });

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
