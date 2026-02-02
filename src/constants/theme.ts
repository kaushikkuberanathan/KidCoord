/**
 * Design Tokens & Constants
 */

export const Colors = {
  // Primary palette
  primary: '#2563EB', // Blue
  primaryDark: '#1D4ED8',
  primaryLight: '#60A5FA',
  
  // Secondary
  secondary: '#10B981', // Green
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  
  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Neutrals
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // UI
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  
  // Status colors for ride states
  needsRide: '#EF4444',
  assigned: '#3B82F6',
  inProgress: '#F59E0B',
  completed: '#10B981',
  
  // Care Credits
  careCreditsGold: '#F59E0B',
  careCreditsLight: '#FEF3C7',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  
  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const Layout = {
  screenPadding: Spacing.md,
  cardPadding: Spacing.md,
  sectionSpacing: Spacing.lg,
};

// Status to color mapping
export const RideStatusColors = {
  NEEDS_RIDE: Colors.error,
  RIDE_ASSIGNED: Colors.info,
  EN_ROUTE_TO_PICKUP: Colors.warning,
  ARRIVED_AT_PICKUP: Colors.warning,
  PICKED_UP: Colors.warning,
  EN_ROUTE_TO_SCHOOL: Colors.warning,
  DROPPED_OFF: Colors.success,
  DELAYED: Colors.warning,
  CANCELLED: Colors.gray400,
  HAS_RIDE: Colors.success,
};

export const RideStatusLabels = {
  NEEDS_RIDE: 'Needs Ride',
  RIDE_ASSIGNED: 'Assigned',
  EN_ROUTE_TO_PICKUP: 'En Route',
  ARRIVED_AT_PICKUP: 'Arrived',
  PICKED_UP: 'Picked Up',
  EN_ROUTE_TO_SCHOOL: 'To School',
  DROPPED_OFF: 'Dropped Off',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
  HAS_RIDE: 'Has Ride',
};
