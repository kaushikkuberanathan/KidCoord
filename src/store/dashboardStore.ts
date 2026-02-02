/**
 * Dashboard Store
 * Manages morning coordination state
 */

import { create } from 'zustand';
import {
  Child,
  User,
  RideRequest,
  Ride,
  DriverAvailability,
  RideStatus,
} from '@/types/domain';

// ============================================================================
// DASHBOARD DATA TYPES
// ============================================================================

export interface ChildWithRide extends Child {
  rideRequest?: RideRequest;
  ride?: Ride;
  driver?: User;
}

export interface MyRideDetails {
  ride: Ride;
  children: Child[];
  parents: User[];
}

// ============================================================================
// DASHBOARD STATE
// ============================================================================

interface DashboardState {
  // Data
  children: ChildWithRide[];
  myAvailability: DriverAvailability | null;
  myRides: MyRideDetails[];
  
  // UI State
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  setChildren: (children: ChildWithRide[]) => void;
  setMyAvailability: (availability: DriverAvailability | null) => void;
  setMyRides: (rides: MyRideDetails[]) => void;
  
  updateChildRideStatus: (childId: string, status: RideStatus) => void;
  updateRideStatus: (rideId: string, status: RideStatus) => void;
  
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  children: [],
  myAvailability: null,
  myRides: [],
  loading: false,
  refreshing: false,
  error: null,
  lastUpdated: null,

  // Set data
  setChildren: (children) => {
    set({ children, lastUpdated: new Date(), error: null });
  },

  setMyAvailability: (availability) => {
    set({ myAvailability: availability, lastUpdated: new Date() });
  },

  setMyRides: (rides) => {
    set({ myRides: rides, lastUpdated: new Date() });
  },

  // Update child ride status
  updateChildRideStatus: (childId, status) => {
    const children = get().children.map((child) => {
      if (child.id === childId && child.rideRequest) {
        return {
          ...child,
          rideRequest: {
            ...child.rideRequest,
            status,
            updatedAt: new Date(),
          },
        };
      }
      return child;
    });
    set({ children, lastUpdated: new Date() });
  },

  // Update ride status
  updateRideStatus: (rideId, status) => {
    // Update in myRides
    const myRides = get().myRides.map((rideDetail) => {
      if (rideDetail.ride.id === rideId) {
        return {
          ...rideDetail,
          ride: {
            ...rideDetail.ride,
            status,
            updatedAt: new Date(),
          },
        };
      }
      return rideDetail;
    });

    // Update in children
    const children = get().children.map((child) => {
      if (child.ride?.id === rideId) {
        return {
          ...child,
          ride: {
            ...child.ride,
            status,
            updatedAt: new Date(),
          },
        };
      }
      return child;
    });

    set({ myRides, children, lastUpdated: new Date() });
  },

  // UI state
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setError: (error) => set({ error, loading: false, refreshing: false }),

  // Reset
  reset: () => {
    set({
      children: [],
      myAvailability: null,
      myRides: [],
      loading: false,
      refreshing: false,
      error: null,
      lastUpdated: null,
    });
  },
}));
