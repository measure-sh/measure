import { useEffect } from 'react';
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
import measure_patch_id from './measurePatchId';

export type RootStackParamList = {
  HomeScreen: undefined;
  ComponentScreen: undefined;
  TracesScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const initializeMeasure = async () => {
    try {
      const measureConfig = new MeasureConfig({
        enableLogging: true,
        autoStart: false,
        enableDiagnosticMode: true,
        patchId: measure_patch_id,
        patchVersion: "OTA_1.0.0"
      });

      await Measure.init({ config: measureConfig });

      Measure.onShake({ handler: () => {
        console.log('Shake detected — launching bug report flow!');
        Measure.launchBugReport({ takeScreenshot: true, bugReportConfig: { source: 'shake' }, attributes: { screen: 'Home' } });
      }});
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