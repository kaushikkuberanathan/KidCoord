/**
 * Navigation Configuration
 * Bottom tab navigation for MVP
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { MorningDashboardScreen } from '@/screens/MorningDashboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { Colors, Typography } from '@/constants/theme';

const Tab = createBottomTabNavigator();

// Placeholder screens for other tabs
const HouseholdScreen = () => (
  <Text style={{ padding: 20 }}>Household Screen - Coming Soon</Text>
);

const DriveScreen = () => (
  <Text style={{ padding: 20 }}>Drive Screen - Coming Soon</Text>
);

const NotificationsScreen = () => (
  <Text style={{ padding: 20 }}>Notifications Screen - Coming Soon</Text>
);

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: 8,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: Typography.xs,
            fontWeight: Typography.medium,
          },
          headerStyle: {
            backgroundColor: Colors.surface,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          },
          headerTitleStyle: {
            fontSize: Typography.lg,
            fontWeight: Typography.semibold,
            color: Colors.textPrimary,
          },
        }}
      >
        <Tab.Screen
          name="Today"
          component={MorningDashboardScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
            headerShown: false,
          }}
        />
        
        <Tab.Screen
          name="MyHousehold"
          component={HouseholdScreen}
          options={{
            tabBarLabel: 'Household',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👨‍👩‍👧‍👦</Text>,
            headerTitle: 'My Household',
          }}
        />
        
        <Tab.Screen
          name="Drive"
          component={DriveScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🚗</Text>,
          }}
        />
        
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🔔</Text>,
          }}
        />
        
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>👤</Text>,
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
