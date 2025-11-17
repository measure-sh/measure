import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Measure, type Span } from '@measuresh/react-native';
import type { RootStackParamList } from './AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';


type TracesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TracesScreen'
>;

// Component for a single action button
const ActionButton = React.memo(
  ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled: boolean }) => (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  )
);

export default function TracesScreen() {
  const [parentSpan, setParentSpan] = useState<Span | null>(null);
  const [checkpointCount, setCheckpointCount] = useState(0);

  const resetState = useCallback(() => {
    setParentSpan(null);
    setCheckpointCount(0);
  }, []);

  const handleCreateParentSpan = useCallback(() => {
    if (parentSpan) {
      Alert.alert(
        'Span Already Active',
        'Please end the current Parent Span before creating a new one.'
      );
      return;
    }

    try {
      const builder = Measure.createSpanBuilder('ParentSpan_Demo');
      
      if (!builder) {
        Alert.alert('Initialization Error', 'Measure SDK may not be initialized or tracing is disabled.');
        return;
      }
      
      const newSpan = builder.startSpan();
      
      setParentSpan(newSpan);
      Alert.alert('Success', 'Parent Span "ParentSpan_Demo" started.');

    } catch (error) {
      console.error('Failed to create parent span:', error);
      Alert.alert('Error', 'Failed to start Parent Span. Check console for details.');
    }
  }, [parentSpan]);

  const handleAddCheckpoint = useCallback(() => {
    if (!parentSpan) {
      Alert.alert('Error', 'No active Parent Span to add a checkpoint to.');
      return;
    }

    try {
      const newCount = checkpointCount + 1;
      const checkpointName = `Checkpoint_${newCount}`;

      // @ts-ignore - Assuming the Span object has a setCheckpoint method
      parentSpan.setCheckpoint(checkpointName);
      
      setCheckpointCount(newCount);
      Alert.alert('Checkpoint Added', `Added checkpoint: ${checkpointName}`);

    } catch (error) {
      console.error('Failed to add checkpoint:', error);
      Alert.alert('Error', 'Failed to add Checkpoint. Check console.');
    }
  }, [parentSpan, checkpointCount]);

  const handleCreateChildSpan = useCallback(() => {
    if (!parentSpan) {
      Alert.alert('Error', 'No active Parent Span to create a child from.');
      return;
    }

    try {
      const childName = 'ChildSpan_Demo_Task';

      const builder = Measure.createSpanBuilder(childName);
      if (!builder) {
        Alert.alert('Initialization Error', 'Measure SDK may not be initialized.');
        return;
      }

      const childSpan = builder
        .setParent(parentSpan)
        .startSpan();
      
      Alert.alert('Success', `Child Span "${childName}" started. Don't forget to end it!`);

      setTimeout(() => {
        childSpan.end();
      }, 500);

    } catch (error) {
      console.error('Failed to create child span:', error);
      Alert.alert('Error', 'Failed to create Child Span. Check console.');
    }
  }, [parentSpan]);

  const handleEndParentSpan = useCallback(() => {
    if (!parentSpan) {
      Alert.alert('Error', 'No active Parent Span to end.');
      return;
    }

    try {
      // @ts-ignore - Assuming the Span object has an end method
      parentSpan.end();

      Alert.alert(
        'Span Ended',
        `Parent Span "ParentSpan_Demo" ended with ${checkpointCount} checkpoints.`
      );
      resetState();
    } catch (error) {
      console.error('Failed to end parent span:', error);
      Alert.alert('Error', 'Failed to end Parent Span. Check console.');
    }
  }, [parentSpan, checkpointCount, resetState]);
  

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Tracing Demo</Text>
      
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>
          Parent Span Status: 
          <Text style={parentSpan ? styles.statusActive : styles.statusInactive}>
            {parentSpan ? ' ACTIVE' : ' INACTIVE'}
          </Text>
        </Text>
        {parentSpan && (
          <Text style={styles.statusDetail}>
            Checkpoints: {checkpointCount}
          </Text>
        )}
      </View>

      <ActionButton
        title="1. Create & Start Parent Span"
        onPress={handleCreateParentSpan}
        disabled={!!parentSpan}
      />

      <ActionButton
        title={`2. Add Checkpoint (Current: ${checkpointCount})`}
        onPress={handleAddCheckpoint}
        disabled={!parentSpan}
      />

      <ActionButton
        title="3. Create & End Child Span"
        onPress={handleCreateChildSpan}
        disabled={!parentSpan}
      />

      <ActionButton
        title="4. End Parent Span"
        onPress={handleEndParentSpan}
        disabled={!parentSpan}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f7fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  statusBox: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderColor: '#007AFF',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusDetail: {
    fontSize: 14,
    marginTop: 5,
    color: '#666',
  },
  statusActive: {
    color: 'green',
    fontWeight: '700',
  },
  statusInactive: {
    color: 'red',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonPressed: {
    backgroundColor: '#0056b3',
  },
  buttonDisabled: {
    backgroundColor: '#a8c6e3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});