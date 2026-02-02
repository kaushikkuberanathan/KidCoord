/**
 * KidCoord Platform Types
 * Core domain model for the coordination framework
 * Architecture: Event-driven, idempotent, audit-first
 */

// ============================================================================
// COORDINATION FRAMEWORK - CORE SIGNALS
// ============================================================================

export enum NeedType {
  DROP_OFF = 'DROP_OFF',
  PICKUP = 'PICKUP',
  HOSTING = 'HOSTING',
}

// ============================================================================
// STATE MACHINES - EXPLICIT STATUS TRANSITIONS
// ============================================================================

// Need Status State Machine
// OPEN → ASSIGNED → (CANCELLED | EXPIRED)
export enum NeedStatus {
  OPEN = 'OPEN',           // Available for matching
  ASSIGNED = 'ASSIGNED',   // RideSession created
  CANCELLED = 'CANCELLED', // Only from OPEN
  EXPIRED = 'EXPIRED',     // System-driven after window
}

// Availability Status State Machine
// ACTIVE → (CLEARED | EXPIRED)
export enum AvailabilityStatus {
  ACTIVE = 'ACTIVE',     // Available for matching
  CLEARED = 'CLEARED',   // Driver removed availability
  EXPIRED = 'EXPIRED',   // System-driven after window
}

// OfferRequest Status State Machine
// SENT → (ACCEPTED | DECLINED | EXPIRED | CANCELLED)
export enum OfferRequestStatus {
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',   // Creates RideSession atomically
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// RideSession Status State Machine
// ASSIGNED → IN_PROGRESS → (COMPLETED | CANCELLED)
export enum RideSessionStatus {
  ASSIGNED = 'ASSIGNED',       // Ride confirmed
  IN_PROGRESS = 'IN_PROGRESS', // Started (ARRIVED or PICKED_UP)
  COMPLETED = 'COMPLETED',     // DROPPED_OFF achieved
  CANCELLED = 'CANCELLED',     // Cancelled with audit
}

// RideStatusEvent Transitions (append-only timeline)
// ARRIVED → PICKED_UP → DROPPED_OFF (no regression allowed)
export enum RideStatusEventType {
  ARRIVED = 'ARRIVED',
  PICKED_UP = 'PICKED_UP',
  DROPPED_OFF = 'DROPPED_OFF',
  DELAYED = 'DELAYED', // Can occur anytime, doesn't advance state
}

// ============================================================================
// A. IDENTITY & ACCESS
// ============================================================================

export interface User {
  id: string;
  phoneHash?: string; // Hashed + normalized
  emailHash?: string; // Hashed + normalized
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  status: 'active' | 'disabled';
  isAdmin: boolean; // MVP admin flag
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  deviceId?: string;
}

// ============================================================================
// B. HOUSEHOLD SETUP
// ============================================================================

export interface Household {
  id: string;
  name?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export enum HouseholdMemberRole {
  PARENT = 'PARENT',
  DRIVER = 'DRIVER',
  HOST = 'HOST',
  ADMIN = 'ADMIN',
}

export interface HouseholdMember {
  id: string; // household_member_id
  householdId: string;
  userId: string;
  roles: HouseholdMemberRole[]; // Can have multiple roles
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

export interface Child {
  id: string;
  householdId: string;
  firstName: string;
  lastInitial?: string; // PII minimization
  status: 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChildSchoolProfile {
  id: string;
  childId: string;
  schoolId: string;
  routeId: string;
  stopId: string;
  communityId?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  householdId: string;
  label: string;
  seatCapacity: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleDriver {
  id: string;
  vehicleId: string;
  householdMemberId: string; // Must have DRIVER role
  createdAt: Date;
}

// ============================================================================
// C. REGISTRY (Admin-managed, versioned)
// ============================================================================

export interface School {
  id: string;
  name: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Route {
  id: string;
  schoolId: string;
  code: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Stop {
  id: string;
  routeId: string;
  name: string;
  geoLat?: number;
  geoLng?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Community {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface RegistryVersion {
  id: string;
  version: string;
  publishedAt: Date;
}

export interface RegistryImportJob {
  id: string;
  status: 'queued' | 'validating' | 'applied' | 'failed';
  createdByUserId: string;
  createdAt: Date;
  completedAt?: Date;
  errorReport?: Record<string, any>;
}

// ============================================================================
// D. COORDINATION ENGINE (MVP: AM Drop-Off)
// ============================================================================

/**
 * Need - A child needs something (drop-off, pickup, hosting)
 * Constraint: One OPEN/ASSIGNED Need per child + date
 */
export interface Need {
  id: string;
  householdId: string;
  childId: string;
  needType: NeedType;
  date: string; // YYYY-MM-DD
  windowStartAt: Date;
  windowEndAt: Date;
  status: NeedStatus;
  createdByMemberId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Availability - A driver is available to help
 * Constraint: No overlapping ACTIVE windows per driver per date
 */
export interface Availability {
  id: string;
  householdMemberId: string; // Must have DRIVER role
  vehicleId: string;
  date: string; // YYYY-MM-DD
  windowStartAt: Date;
  windowEndAt: Date;
  seatCapacityAtTime: number;
  seatsAvailable: number; // Decrements as rides assigned
  preferenceSchoolId?: string;
  preferenceRouteId?: string;
  preferenceStopId?: string;
  status: AvailabilityStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OfferRequest - Connects Need with Availability
 * Either parent requests from driver, or driver offers to parent
 * Constraint: Only one ACCEPTED per Need
 */
export interface OfferRequest {
  id: string;
  type: 'OFFER' | 'REQUEST';
  needId: string;
  availabilityId: string;
  fromMemberId: string;
  toMemberId: string;
  status: OfferRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RideSession - Execution unit for a ride
 * Created atomically when OfferRequest is ACCEPTED
 */
export interface RideSession {
  id: string;
  date: string;
  needId: string;
  driverMemberId: string;
  vehicleId: string;
  seatCountReserved: number;
  sessionStatus: RideSessionStatus;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RideParticipant - Tracks roles in a RideSession
 */
export interface RideParticipant {
  id: string;
  rideSessionId: string;
  householdMemberId: string;
  roleInSession: 'REQUESTER_PARENT' | 'DRIVER';
  createdAt: Date;
}

/**
 * RideStatusEvent - Append-only timeline of ride progress
 * Allowed transitions: ARRIVED → PICKED_UP → DROPPED_OFF (no regression)
 */
export interface RideStatusEvent {
  id: string;
  rideSessionId: string;
  status: RideStatusEventType;
  actorMemberId: string;
  eventAt: Date;
  geoLat?: number;
  geoLng?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// E. CARE CREDITS (Event-driven, idempotent)
// ============================================================================

export enum CareCreditEventType {
  RIDE_COMPLETED = 'RIDE_COMPLETED',
  // Future: HOST_COMPLETED, PICKUP_COMPLETED, etc.
}

/**
 * CareCreditEvent - Append-only, issued by system rules
 * Trigger: RideSession transitions to COMPLETED
 * Constraint: One event per qualifying session + actor (idempotent)
 */
export interface CareCreditEvent {
  id: string;
  eventType: CareCreditEventType;
  actorMemberId: string; // Who earned it (e.g., driver)
  beneficiaryMemberId?: string; // Optional: enables bilateral view
  householdId?: string; // Optional: for household-level rollups
  contextType: 'RIDE_SESSION'; // Extensible
  contextId: string; // ride_session_id
  units: number; // Default 1
  eventAt: Date;
  createdAt: Date;
}

/**
 * CareCreditSummary - Cached aggregate for fast profile reads
 * Updated asynchronously when CareCreditEvent is created
 */
export interface CareCreditSummary {
  householdMemberId: string;
  totalEarned: number;
  byEventType: Record<CareCreditEventType, number>;
  lastCalculatedAt: Date;
}

/**
 * CareCreditPairBalance - Bilateral relationship (Phase 2)
 * Shows "who has helped whom more"
 */
export interface CareCreditPairBalance {
  memberAId: string;
  memberBId: string;
  netUnits: number; // Positive means A owes B
  lastEventAt: Date;
}


// ============================================================================
// F. SAFETY & TRUST
// ============================================================================

/**
 * Blocklist - Private child-level driver exclusion
 * Rule: Blocked drivers excluded at matching + offer creation
 */
export interface Blocklist {
  id: string;
  childId: string;
  blockedHouseholdMemberId: string;
  createdByMemberId: string;
  reason?: string;
  status: 'active' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Verification - Optional MVP feature
 */
export interface Verification {
  userId: string;
  verificationLevel: string;
  verifiedAt: Date;
}


// ============================================================================
// G. NOTIFICATIONS + REALTIME
// ============================================================================

export enum NotificationCategory {
  REQUESTS = 'REQUESTS',
  ACCEPTANCE = 'ACCEPTANCE',
  STATUS = 'STATUS',
  DELAYS = 'DELAYS',
  COMPLETION = 'COMPLETION',
  CARE_CREDITS = 'CARE_CREDITS',
}

export interface NotificationPreference {
  householdMemberId: string;
  category: NotificationCategory;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface Notification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink?: string;
  status: 'CREATED' | 'SENT' | 'FAILED' | 'READ';
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  providerMessageId?: string;
}

/**
 * OutboxEvent - Reliability pattern for async operations
 * Guarantees notifications and Care Credits issuance even if downstream service is down
 */
export interface OutboxEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: Date;
  processedAt?: Date;
}

// ============================================================================
// H. AUDIT + OBSERVABILITY
// ============================================================================

export enum AuditEventType {
  // Need lifecycle
  NEED_CREATED = 'NEED_CREATED',
  NEED_CANCELLED = 'NEED_CANCELLED',
  
  // Availability lifecycle
  AVAILABILITY_CREATED = 'AVAILABILITY_CREATED',
  AVAILABILITY_CLEARED = 'AVAILABILITY_CLEARED',
  
  // Offer/Request
  OFFER_REQUEST_SENT = 'OFFER_REQUEST_SENT',
  OFFER_REQUEST_ACCEPTED = 'OFFER_REQUEST_ACCEPTED',
  OFFER_REQUEST_DECLINED = 'OFFER_REQUEST_DECLINED',
  
  // RideSession lifecycle
  RIDE_SESSION_ASSIGNED = 'RIDE_SESSION_ASSIGNED',
  RIDE_SESSION_STARTED = 'RIDE_SESSION_STARTED',
  RIDE_SESSION_COMPLETED = 'RIDE_SESSION_COMPLETED',
  RIDE_SESSION_CANCELLED = 'RIDE_SESSION_CANCELLED',
  
  // RideStatusEvent
  RIDE_STATUS_ARRIVED = 'RIDE_STATUS_ARRIVED',
  RIDE_STATUS_PICKED_UP = 'RIDE_STATUS_PICKED_UP',
  RIDE_STATUS_DROPPED_OFF = 'RIDE_STATUS_DROPPED_OFF',
  RIDE_STATUS_DELAYED = 'RIDE_STATUS_DELAYED',
  
  // Safety
  DRIVER_BLOCKED = 'DRIVER_BLOCKED',
  DRIVER_UNBLOCKED = 'DRIVER_UNBLOCKED',
  
  // Care Credits
  CARE_CREDIT_ISSUED = 'CARE_CREDIT_ISSUED',
  
  // Admin actions
  ADMIN_OVERRIDE = 'ADMIN_OVERRIDE',
  ADMIN_REASSIGNMENT = 'ADMIN_REASSIGNMENT',
}

/**
 * AuditEvent - Immutable log of all meaningful actions
 */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  actorUserId?: string;
  actorMemberId?: string;
  householdId?: string;
  entityType: string;
  entityId: string;
  eventAt: Date;
  deviceId?: string;
  ipHash?: string;
  metadata?: Record<string, any>;
  integrityHash?: string; // Optional: for tamper detection
}

/**
 * IdempotencyKey - Prevents duplicate requests (mobile reliability)
 * Strongly recommended for all write operations
 */
export interface IdempotencyKey {
  key: string; // PK
  userId: string;
  route: string; // Endpoint name
  requestHash: string;
  responseBody: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}
