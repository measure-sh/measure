import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import ComponentScreen from './ComponentScreen';

export type RootStackParamList = {
  Home: undefined;
  ComponentScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ComponentScreen" component={ComponentScreen} />
    </Stack.Navigator>
  );
}