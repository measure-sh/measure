import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import HomeScreen from './HomeScreen';
import { Measure, ClientInfo, BaseMeasureConfig } from '@measuresh/react-native';

export default function App() {
  const initializeMeasure = async () => {
    const clientInfo = new ClientInfo(
      'msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c',
      'https://api.measure.sh'
    );

    const measureConfig = new BaseMeasureConfig(
      true,  // enableLogging
      0.7,   // samplingRateForErrorFreeSessions
      0.1,   // traceSamplingRate
      false, // trackHttpHeaders
      false, // trackHttpBody
      [],    // httpHeadersBlocklist
      [],    // httpUrlBlocklist
      [],    // httpUrlAllowlist
      false, // autoStart
      true   // trackViewControllerLoadTime
    );

    // Measure.init(clientInfo, measureConfig);
    const [result1, result2, result3, result4, result5] = await Promise.all([
      Measure.init(clientInfo, measureConfig),
      Measure.init(clientInfo, measureConfig),
      Measure.init(clientInfo, measureConfig),
      Measure.init(clientInfo, measureConfig),
      Measure.init(clientInfo, measureConfig),
    ]);
  };

  useEffect(() => {
    initializeMeasure();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <HomeScreen />
    </SafeAreaView>
  );
}