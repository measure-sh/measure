import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  TextInput,
  Switch,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './AppNavigator';
import { Measure } from '@measuresh/react-native';


type ComponentScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ComponentScreen'
>;

export default function ComponentScreen() {
  const navigation = useNavigation<ComponentScreenNavigationProp>();

  const [textValue, setTextValue] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  const showAlert = () => {
    Alert.alert('Hello!', 'This is a sample alert.', [{ text: 'OK' }]);
  };

    useFocusEffect(
    useCallback(() => {
      Measure.trackScreenView('ComponentScreen', {
    screen: 'Home',
    action: 'Track Custom Event',
    timestamped: true,
  })
        .catch(err => console.error('Failed to track screen view:', err));
    }, [])
  );
  

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Button */}
      <Button title="Show Alert" onPress={showAlert} />

      {/* Custom TouchableOpacity button */}
      <TouchableOpacity style={styles.customButton} onPress={() => Alert.alert('Pressed!')}>
        <Text style={styles.customButtonText}>Custom Button</Text>
      </TouchableOpacity>

      {/* TextInput */}
      <TextInput
        style={styles.input}
        placeholder="Type something..."
        value={textValue}
        onChangeText={setTextValue}
      />
      <Text>Typed value: {textValue}</Text>

      {/* Switch */}
      <View style={styles.row}>
        <Text>Enable feature:</Text>
        <Switch value={isEnabled} onValueChange={setIsEnabled} />
      </View>

      {/* Go Back Button */}
      <Button title="Go Back" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  customButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  customButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
});