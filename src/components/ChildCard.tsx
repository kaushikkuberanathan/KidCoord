/**
 * ChildCard Component
 * Displays child with ride status and quick actions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing, Shadow, RideStatusColors, RideStatusLabels } from '@/constants/theme';
import { ChildWithRide } from '@/store/dashboardStore';
import { RideStatus } from '@/types/domain';

interface ChildCardProps {
  child: ChildWithRide;
  onToggleNeedsRide: () => void;
  onViewDetails: () => void;
}

export const ChildCard: React.FC<ChildCardProps> = ({
  child,
  onToggleNeedsRide,
  onViewDetails,
}) => {
  const getRideStatus = (): RideStatus => {
    if (child.rideRequest) {
      return child.rideRequest.status;
    }
    return RideStatus.HAS_RIDE; // Default assumption
  };

  const status = getRideStatus();
  const statusColor = RideStatusColors[status];
  const statusLabel = RideStatusLabels[status];
  const needsRide = status === RideStatus.NEEDS_RIDE;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onViewDetails}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        {/* Child info */}
        <View style={styles.childInfo}>
          {child.photoUrl ? (
            <Image source={{ uri: child.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {child.firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          <View style={styles.nameContainer}>
            <Text style={styles.childName}>
              {child.firstName} {child.lastName}
            </Text>
            {child.grade && (
              <Text style={styles.grade}>Grade {child.grade}</Text>
            )}
          </View>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {/* Driver info (if assigned) */}
      {child.driver && (
        <View style={styles.driverInfo}>
          <Text style={styles.driverLabel}>Driver:</Text>
          <Text style={styles.driverName}>
            {child.driver.firstName} {child.driver.lastName}
          </Text>
        </View>
      )}

      {/* Action button */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            needsRide ? styles.needsRideButton : styles.hasRideButton,
          ]}
          onPress={onToggleNeedsRide}
        >
          <Text
            style={[
              styles.actionButtonText,
              needsRide ? styles.needsRideText : styles.hasRideText,
            ]}
          >
            {needsRide ? '🚗 Find Ride' : '✓ Has Ride'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  nameContainer: {
    flex: 1,
  },
  childName: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  grade: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  driverLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  driverName: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  actionContainer: {
    marginTop: Spacing.sm,
  },
  actionButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  needsRideButton: {
    backgroundColor: Colors.error,
  },
  hasRideButton: {
    backgroundColor: Colors.gray100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  needsRideText: {
    color: Colors.textInverse,
  },
  hasRideText: {
    color: Colors.textPrimary,
  },
});
