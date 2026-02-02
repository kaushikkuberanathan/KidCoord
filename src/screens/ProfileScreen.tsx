/**
 * Profile Screen
 * User profile with Care Credits summary
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/appStore';
import { Colors, Typography, Spacing, Layout, BorderRadius, Shadow } from '@/constants/theme';
import { Button } from '@/components/Button';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAppStore();

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          {user.profileImageUrl ? (
            <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {user.firstName.charAt(0).toUpperCase()}
                {user.lastName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified</Text>
            </View>
          )}
        </View>

        {/* Care Credits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Care Credits</Text>
          
          <View style={styles.creditsCard}>
            <View style={styles.creditsHeader}>
              <Text style={styles.creditsLabel}>Total Credits Earned</Text>
              <View style={styles.creditsValue}>
                <Text style={styles.creditsNumber}>{user.careCredits}</Text>
                <Text style={styles.creditsIcon}>✨</Text>
              </View>
            </View>
            
            <Text style={styles.creditsDescription}>
              Care Credits recognize your contributions to the community. You earn 1 credit for each completed ride.
            </Text>

            <View style={styles.breakdown}>
              <Text style={styles.breakdownTitle}>Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>School Drop-offs</Text>
                <Text style={styles.breakdownValue}>{user.careCredits}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Pickups</Text>
                <Text style={styles.breakdownValue}>0</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Hosting</Text>
                <Text style={styles.breakdownValue}>0</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.viewHistoryButton}>
              <Text style={styles.viewHistoryText}>View History →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>My Household</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Safety Preferences</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Notifications</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Help Center</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Terms of Service</Text>
            <Text style={styles.menuItemArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            title="Log Out"
            onPress={handleLogout}
            variant="outline"
            fullWidth
          />
        </View>

        {/* Version */}
        <Text style={styles.version}>Version 0.1.0 (MVP)</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Layout.screenPadding,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textInverse,
    fontSize: Typography.xxxl,
    fontWeight: Typography.bold,
  },
  name: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  verifiedText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
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
  creditsCard: {
    backgroundColor: Colors.careCreditsLight,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.careCreditsGold,
  },
  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  creditsLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  creditsValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditsNumber: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.bold,
    color: Colors.careCreditsGold,
    marginRight: Spacing.xs,
  },
  creditsIcon: {
    fontSize: Typography.xxl,
  },
  creditsDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  breakdown: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  breakdownTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  breakdownLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  viewHistoryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  viewHistoryText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.careCreditsGold,
  },
  menuItem: {
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  menuItemText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  menuItemArrow: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
  },
  logoutContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  version: {
    textAlign: 'center',
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },
});
