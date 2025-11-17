import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import ComponentScreen from './ComponentScreen';
import TracesScreen from './TracesScreen';

export type RootStackParamList = {
  Home: undefined;
  ComponentScreen: undefined;
  TracesScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ComponentScreen" component={ComponentScreen} />
      <Stack.Screen name="TracesScreen" component={TracesScreen} />
    </Stack.Navigator>
  );
}