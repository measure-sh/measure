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
  Modal,
  Image,
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

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const showAlert = () => {
    Alert.alert('Hello!', 'This is a sample alert.', [{ text: 'OK' }]);
  };

  useFocusEffect(
    useCallback(() => {
      Measure.trackScreenView('ComponentScreen', {
        screen: 'ComponentScreen',
        timestamped: true,
      }).catch(err =>
        console.error('Failed to track screen view:', err)
      );
    }, [])
  );

  const captureScreenshot = async () => {
    try {
      const result = await Measure.captureScreenshot();

      if (!result) {
        console.warn('No screenshot returned');
        return;
      }

      if (result.path) {
        setImageUri('file://' + result.path);
      } else if (result.bytes) {
        setImageUri(`data:image/png;base64,${result.bytes}`);
      } else {
        console.warn('No path or bytes found in screenshot');
        return;
      }

      setModalVisible(true);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Screenshot Preview Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.screenshotImage}
                resizeMode="contain"
              />
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Screenshot Button */}
      <TouchableOpacity
        style={[styles.customButton, styles.screenshotButton]}
        onPress={captureScreenshot}
      >
        <Text style={styles.customButtonText}>📸 Take Screenshot</Text>
      </TouchableOpacity>

      {/* Alert Button */}
      <Button title="Show Alert" onPress={showAlert} />

      {/* Custom Button */}
      <TouchableOpacity
        style={styles.customButton}
        onPress={() => Alert.alert('Pressed!')}
      >
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

      {/* Navigation */}
      <Button title="Go Back" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },

  customButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
  },

  screenshotButton: {
    backgroundColor: '#34C759',
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  screenshotImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
    backgroundColor: '#eee',
  },

  closeButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 8,
  },

  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});