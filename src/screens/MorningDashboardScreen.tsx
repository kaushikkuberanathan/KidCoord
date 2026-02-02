/**
 * Morning Dashboard Screen
 * Primary coordination interface for school drop-off
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { useAppStore } from '@/store/appStore';
import { useDashboardStore, ChildWithRide } from '@/store/dashboardStore';
import { ChildCard } from '@/components/ChildCard';
import { Button } from '@/components/Button';
import { Colors, Typography, Spacing, Layout } from '@/constants/theme';
import {
  fetchMorningDashboard,
  createRideRequest,
  markChildHasRide,
  createAvailability,
} from '@/services/dashboardService';
import { RideStatus } from '@/types/domain';

export const MorningDashboardScreen: React.FC = () => {
  const { selectedDate, user } = useAppStore();
  const {
    children,
    myAvailability,
    myRides,
    loading,
    refreshing,
    error,
    setChildren,
    setMyAvailability,
    setMyRides,
    setLoading,
    setRefreshing,
    setError,
  } = useDashboardStore();

  // Load dashboard data
  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error: apiError } = await fetchMorningDashboard(selectedDate);

    if (data) {
      setChildren(data.children.map((item) => ({
        ...item.child,
        rideRequest: item.rideRequest,
        ride: item.ride,
        driver: item.driver,
      })));
      setMyAvailability(data.myAvailability || null);
      setMyRides(data.myRides);
      setError(null);
    } else {
      setError(apiError || 'Failed to load dashboard');
    }

    setLoading(false);
    setRefreshing(false);
  }, [selectedDate]);

  useEffect(() => {
    loadDashboard();
  }, [selectedDate]);

  // Handle toggle needs ride
  const handleToggleNeedsRide = async (child: ChildWithRide) => {
    const needsRide = child.rideRequest?.status === RideStatus.NEEDS_RIDE;

    if (needsRide) {
      // Mark as has ride
      const { success, error: apiError } = await markChildHasRide({
        childId: child.id,
        date: selectedDate,
      });

      if (success) {
        loadDashboard(true);
      } else {
        Alert.alert('Error', apiError || 'Failed to update ride status');
      }
    } else {
      // Request ride
      const { data, error: apiError } = await createRideRequest({
        childId: child.id,
        date: selectedDate,
        schoolId: child.schoolId,
      });

      if (data) {
        loadDashboard(true);
      } else {
        Alert.alert('Error', apiError || 'Failed to create ride request');
      }
    }
  };

  // Handle "I Can Drive" action
  const handleCanDrive = () => {
    if (myAvailability) {
      Alert.alert(
        'Already Available',
        'You are already available to drive this morning. Would you like to cancel your availability?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Cancel Availability',
            style: 'destructive',
            onPress: () => {
              // TODO: Cancel availability
              loadDashboard(true);
            },
          },
        ]
      );
    } else {
      // Navigate to availability form
      Alert.alert('Create Availability', 'Availability form would open here');
    }
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Good morning, {user?.firstName}!</Text>
        <Text style={styles.date}>{format(new Date(selectedDate), 'EEEE, MMMM d')}</Text>
      </View>
    </View>
  );

  // Render children section
  const renderChildren = () => {
    if (children.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No children added yet</Text>
          <Button title="Add Child" onPress={() => {}} variant="outline" />
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Children</Text>
        {children.map((child) => (
          <ChildCard
            key={child.id}
            child={child}
            onToggleNeedsRide={() => handleToggleNeedsRide(child)}
            onViewDetails={() => {}}
          />
        ))}
      </View>
    );
  };

  // Render driver section
  const renderDriverSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Volunteer to Drive</Text>
      
      {myAvailability ? (
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <Text style={styles.availabilityTitle}>You're Available!</Text>
            <View style={styles.seatsBadge}>
              <Text style={styles.seatsText}>{myAvailability.seatsAvailable} seats</Text>
            </View>
          </View>
          <Text style={styles.availabilityTime}>
            {myAvailability.pickupWindowStart} - {myAvailability.pickupWindowEnd}
          </Text>
          
          {myRides.length > 0 && (
            <View style={styles.ridesAssigned}>
              <Text style={styles.ridesAssignedText}>
                {myRides.length} ride{myRides.length > 1 ? 's' : ''} assigned
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Button
          title="I Can Drive"
          onPress={handleCanDrive}
          variant="secondary"
          fullWidth
        />
      )}
    </View>
  );

  // Render my rides section
  const renderMyRides = () => {
    if (myRides.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Morning</Text>
        {myRides.map((rideDetail) => (
          <View key={rideDetail.ride.id} style={styles.rideCard}>
            <Text style={styles.rideTitle}>Pickup at {format(new Date(), 'h:mm a')}</Text>
            <Text style={styles.rideChildren}>
              {rideDetail.children.map((c) => c.firstName).join(', ')}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />
        }
      >
        {renderHeader()}
        {renderChildren()}
        {renderDriverSection()}
        {renderMyRides()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Layout.screenPadding,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  date: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  availabilityCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
  },
  availabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  availabilityTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  seatsBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  seatsText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textInverse,
  },
  availabilityTime: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  ridesAssigned: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ridesAssignedText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.primary,
  },
  rideCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  rideTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  rideChildren: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
});
