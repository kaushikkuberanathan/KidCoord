/**
 * API Service Types
 * Request/Response contracts for KidCoord backend
 */

import {
  User,
  Child,
  Household,
  School,
  RideRequest,
  Ride,
  DriverAvailability,
  CareCredit,
  CareCreditsProfile,
  BilateralCredits,
  AuditEvent,
  Notification,
  RideStatus,
} from './domain';

// ============================================================================
// API RESPONSE WRAPPER
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

// ============================================================================
// RIDE REQUESTS
// ============================================================================

export interface CreateRideRequestRequest {
  childId: string;
  date: string; // ISO date
  schoolId: string;
}

export interface CancelRideRequestRequest {
  rideRequestId: string;
  reason?: string;
}

export interface MarkChildHasRideRequest {
  childId: string;
  date: string;
}

// ============================================================================
// DRIVER AVAILABILITY
// ============================================================================

export interface CreateAvailabilityRequest {
  date: string;
  seatsAvailable: number;
  pickupWindowStart: string;
  pickupWindowEnd: string;
}

export interface UpdateAvailabilityRequest {
  availabilityId: string;
  seatsAvailable?: number;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
}

export interface CancelAvailabilityRequest {
  availabilityId: string;
}

// ============================================================================
// RIDE ASSIGNMENT & EXECUTION
// ============================================================================

export interface AssignRideRequest {
  rideRequestIds: string[]; // Multiple children can be assigned to one ride
  driverId: string;
  availabilityId: string;
}

export interface UpdateRideStatusRequest {
  rideId: string;
  status: RideStatus;
  timestamp?: string;
  notes?: string;
}

// ============================================================================
// MATCHING
// ============================================================================

export interface MatchingRequest {
  date: string;
  schoolId: string;
}

export interface MatchingResponse {
  availableDrivers: Array<{
    driver: User;
    availability: DriverAvailability;
    seatsAvailable: number;
    matchedRequests: RideRequest[];
    distance?: number; // miles from school
  }>;
  unmatchedRequests: RideRequest[];
}

// ============================================================================
// HOUSEHOLD & CHILDREN
// ============================================================================

export interface AddChildRequest {
  firstName: string;
  lastName: string;
  grade?: string;
  schoolId: string;
}

export interface UpdateChildRequest {
  childId: string;
  firstName?: string;
  lastName?: string;
  grade?: string;
  schoolId?: string;
}

export interface BlockDriverRequest {
  childId: string;
  driverId: string;
}

export interface UnblockDriverRequest {
  childId: string;
  driverId: string;
}

// ============================================================================
// CARE CREDITS
// ============================================================================

export interface GetCareCreditsProfileRequest {
  userId: string;
}

export interface GetBilateralCreditsRequest {
  userBId: string; // Get relationship between current user and userB
}

export interface GetCareCreditsHistoryRequest {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface CareCreditsHistoryResponse {
  credits: CareCredit[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface MorningDashboardRequest {
  date: string;
}

export interface MorningDashboardResponse {
  children: Array<{
    child: Child;
    rideRequest?: RideRequest;
    ride?: Ride;
    driver?: User;
  }>;
  myAvailability?: DriverAvailability;
  myRides: Array<{
    ride: Ride;
    children: Child[];
    parents: User[];
  }>;
  notifications: Notification[];
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export interface GetNotificationsRequest {
  limit?: number;
  unreadOnly?: boolean;
}

export interface MarkNotificationReadRequest {
  notificationId: string;
}

// ============================================================================
// ADMIN
// ============================================================================

export interface AdminOverrideRequest {
  rideId: string;
  action: 'CANCEL' | 'REASSIGN' | 'COMPLETE';
  newDriverId?: string;
  reason: string;
}

export interface AdminAuditLogRequest {
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AdminAuditLogResponse {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}
