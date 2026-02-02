/**
 * KidCoord Application Store
 * Zustand state management with persistence
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Child, Household, School, Notification } from '@/types/domain';

// ============================================================================
// AUTH SLICE
// ============================================================================

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setUser: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

// ============================================================================
// HOUSEHOLD SLICE
// ============================================================================

interface HouseholdState {
  household: Household | null;
  children: Child[];
  
  setHousehold: (household: Household) => void;
  setChildren: (children: Child[]) => void;
  addChild: (child: Child) => void;
  updateChild: (childId: string, updates: Partial<Child>) => void;
  removeChild: (childId: string) => void;
}

// ============================================================================
// SCHOOL SLICE
// ============================================================================

interface SchoolState {
  schools: School[];
  selectedSchoolId: string | null;
  
  setSchools: (schools: School[]) => void;
  setSelectedSchool: (schoolId: string) => void;
}

// ============================================================================
// NOTIFICATIONS SLICE
// ============================================================================

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  clearAll: () => void;
}

// ============================================================================
// APP STATE SLICE
// ============================================================================

interface AppState {
  selectedDate: string; // ISO date string for dashboard
  isOnline: boolean;
  
  setSelectedDate: (date: string) => void;
  setOnlineStatus: (isOnline: boolean) => void;
}

// ============================================================================
// COMBINED STORE
// ============================================================================

interface AppStore extends AuthState, HouseholdState, SchoolState, NotificationsState, AppState {
  // Persistence
  hydrate: () => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ============================================================================
  // AUTH STATE
  // ============================================================================
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user, token) => {
    set({ user, token, isAuthenticated: true });
    AsyncStorage.setItem('user', JSON.stringify(user));
    AsyncStorage.setItem('token', token);
  },

  logout: async () => {
    set({ user: null, token: null, isAuthenticated: false });
    await AsyncStorage.multiRemove(['user', 'token']);
  },

  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser });
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  },

  // ============================================================================
  // HOUSEHOLD STATE
  // ============================================================================
  household: null,
  children: [],

  setHousehold: (household) => {
    set({ household });
    AsyncStorage.setItem('household', JSON.stringify(household));
  },

  setChildren: (children) => {
    set({ children });
    AsyncStorage.setItem('children', JSON.stringify(children));
  },

  addChild: (child) => {
    const children = [...get().children, child];
    set({ children });
    AsyncStorage.setItem('children', JSON.stringify(children));
  },

  updateChild: (childId, updates) => {
    const children = get().children.map((child) =>
      child.id === childId ? { ...child, ...updates } : child
    );
    set({ children });
    AsyncStorage.setItem('children', JSON.stringify(children));
  },

  removeChild: (childId) => {
    const children = get().children.filter((child) => child.id !== childId);
    set({ children });
    AsyncStorage.setItem('children', JSON.stringify(children));
  },

  // ============================================================================
  // SCHOOL STATE
  // ============================================================================
  schools: [],
  selectedSchoolId: null,

  setSchools: (schools) => {
    set({ schools });
    AsyncStorage.setItem('schools', JSON.stringify(schools));
  },

  setSelectedSchool: (schoolId) => {
    set({ selectedSchoolId: schoolId });
    AsyncStorage.setItem('selectedSchoolId', schoolId);
  },

  // ============================================================================
  // NOTIFICATIONS STATE
  // ============================================================================
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },

  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications];
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },

  markAsRead: (notificationId) => {
    const notifications = get().notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  // ============================================================================
  // APP STATE
  // ============================================================================
  selectedDate: new Date().toISOString().split('T')[0],
  isOnline: true,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
  },

  setOnlineStatus: (isOnline) => {
    set({ isOnline });
  },

  // ============================================================================
  // PERSISTENCE
  // ============================================================================
  hydrate: async () => {
    try {
      const [user, token, household, children, schools, selectedSchoolId] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('household'),
        AsyncStorage.getItem('children'),
        AsyncStorage.getItem('schools'),
        AsyncStorage.getItem('selectedSchoolId'),
      ]);

      set({
        user: user ? JSON.parse(user) : null,
        token: token || null,
        isAuthenticated: !!(user && token),
        household: household ? JSON.parse(household) : null,
        children: children ? JSON.parse(children) : [],
        schools: schools ? JSON.parse(schools) : [],
        selectedSchoolId: selectedSchoolId || null,
      });
    } catch (error) {
      console.error('Error hydrating store:', error);
    }
  },

  reset: async () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      household: null,
      children: [],
      schools: [],
      selectedSchoolId: null,
      notifications: [],
      unreadCount: 0,
      selectedDate: new Date().toISOString().split('T')[0],
    });
    await AsyncStorage.clear();
  },
}));
