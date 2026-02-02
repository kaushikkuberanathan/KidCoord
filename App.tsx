/**
 * KidCoord App
 * Main application entry point
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from '@/navigation/AppNavigator';
import { useAppStore } from '@/store/appStore';
import { Colors } from '@/constants/theme';

const App: React.FC = () => {
  const { isAuthenticated, hydrate } = useAppStore();
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    // Hydrate store from AsyncStorage
    const initializeApp = async () => {
      await hydrate();
      setIsHydrating(false);
    };

    initializeApp();
  }, []);

  if (isHydrating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading KidCoord...</Text>
      </View>
    );
  }

  // TODO: Add authentication flow
  // For MVP, we'll assume user is authenticated
  // In production, check isAuthenticated and show LoginScreen if false

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <AppNavigator />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default App;
