/**
 * State Machine Validation
 * Enforces valid state transitions for all entities
 */

import { logger } from '@/utils/logger';

// ============================================================================
// STATE ENUMS
// ============================================================================

export enum NeedStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum AvailabilityStatus {
  ACTIVE = 'ACTIVE',
  CLEARED = 'CLEARED',
  EXPIRED = 'EXPIRED',
}

export enum OfferRequestStatus {
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum RideSessionStatus {
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RideStatusEventType {
  ARRIVED = 'ARRIVED',
  PICKED_UP = 'PICKED_UP',
  DROPPED_OFF = 'DROPPED_OFF',
  DELAYED = 'DELAYED',
}

// ============================================================================
// STATE TRANSITION MAPS
// ============================================================================

const NEED_TRANSITIONS: Record<NeedStatus, NeedStatus[]> = {
  [NeedStatus.OPEN]: [NeedStatus.ASSIGNED, NeedStatus.CANCELLED, NeedStatus.EXPIRED],
  [NeedStatus.ASSIGNED]: [], // Terminal
  [NeedStatus.CANCELLED]: [], // Terminal
  [NeedStatus.EXPIRED]: [], // Terminal
};

const AVAILABILITY_TRANSITIONS: Record<AvailabilityStatus, AvailabilityStatus[]> = {
  [AvailabilityStatus.ACTIVE]: [AvailabilityStatus.CLEARED, AvailabilityStatus.EXPIRED],
  [AvailabilityStatus.CLEARED]: [], // Terminal
  [AvailabilityStatus.EXPIRED]: [], // Terminal
};

const OFFER_REQUEST_TRANSITIONS: Record<OfferRequestStatus, OfferRequestStatus[]> = {
  [OfferRequestStatus.SENT]: [
    OfferRequestStatus.ACCEPTED,
    OfferRequestStatus.DECLINED,
    OfferRequestStatus.EXPIRED,
    OfferRequestStatus.CANCELLED,
  ],
  [OfferRequestStatus.ACCEPTED]: [], // Terminal
  [OfferRequestStatus.DECLINED]: [], // Terminal
  [OfferRequestStatus.EXPIRED]: [], // Terminal
  [OfferRequestStatus.CANCELLED]: [], // Terminal
};

const RIDE_SESSION_TRANSITIONS: Record<RideSessionStatus, RideSessionStatus[]> = {
  [RideSessionStatus.ASSIGNED]: [RideSessionStatus.IN_PROGRESS, RideSessionStatus.CANCELLED],
  [RideSessionStatus.IN_PROGRESS]: [RideSessionStatus.COMPLETED, RideSessionStatus.CANCELLED],
  [RideSessionStatus.COMPLETED]: [], // Terminal
  [RideSessionStatus.CANCELLED]: [], // Terminal
};

const RIDE_STATUS_EVENT_PROGRESSION: Record<RideStatusEventType, RideStatusEventType[]> = {
  [RideStatusEventType.ARRIVED]: [RideStatusEventType.PICKED_UP, RideStatusEventType.DROPPED_OFF],
  [RideStatusEventType.PICKED_UP]: [RideStatusEventType.DROPPED_OFF],
  [RideStatusEventType.DROPPED_OFF]: [], // Terminal
  [RideStatusEventType.DELAYED]: [], // Informational, doesn't advance
};

// ============================================================================
// ERROR CLASS
// ============================================================================

export class StateTransitionError extends Error {
  constructor(
    public entity: string,
    public currentState: string,
    public attemptedState: string,
    public details?: string
  ) {
    super(
      `Invalid ${entity} state transition: ${currentState} → ${attemptedState}` +
      (details ? ` (${details})` : '')
    );
    this.name = 'StateTransitionError';
  }
  
  toJSON() {
    return {
      code: 'STATE_TRANSITION_ERROR',
      message: this.message,
      entity: this.entity,
      currentState: this.currentState,
      attemptedState: this.attemptedState,
      details: this.details,
    };
  }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Need status transition
 */
export function validateNeedTransition(
  current: NeedStatus,
  next: NeedStatus
): void {
  const validNext = NEED_TRANSITIONS[current] || [];
  
  if (!validNext.includes(next)) {
    throw new StateTransitionError('Need', current, next);
  }
  
  logger.debug('Need state transition validated', { current, next });
}

/**
 * Validate Availability status transition
 */
export function validateAvailabilityTransition(
  current: AvailabilityStatus,
  next: AvailabilityStatus
): void {
  const validNext = AVAILABILITY_TRANSITIONS[current] || [];
  
  if (!validNext.includes(next)) {
    throw new StateTransitionError('Availability', current, next);
  }
  
  logger.debug('Availability state transition validated', { current, next });
}

/**
 * Validate OfferRequest status transition
 */
export function validateOfferRequestTransition(
  current: OfferRequestStatus,
  next: OfferRequestStatus
): void {
  const validNext = OFFER_REQUEST_TRANSITIONS[current] || [];
  
  if (!validNext.includes(next)) {
    throw new StateTransitionError('OfferRequest', current, next);
  }
  
  logger.debug('OfferRequest state transition validated', { current, next });
}

/**
 * Validate RideSession status transition
 */
export function validateRideSessionTransition(
  current: RideSessionStatus,
  next: RideSessionStatus
): void {
  const validNext = RIDE_SESSION_TRANSITIONS[current] || [];
  
  if (!validNext.includes(next)) {
    throw new StateTransitionError('RideSession', current, next);
  }
  
  logger.debug('RideSession state transition validated', { current, next });
}

/**
 * Validate RideStatusEvent progression
 * Note: This is append-only, so we only check if new event is valid after last event
 */
export function validateRideStatusEventProgression(
  lastEvent: RideStatusEventType | null,
  newEvent: RideStatusEventType
): void {
  // DELAYED can occur anytime
  if (newEvent === RideStatusEventType.DELAYED) {
    return;
  }
  
  // If no previous events, any starting event is valid
  if (!lastEvent) {
    return;
  }
  
  // DELAYED doesn't advance state, so check actual progression
  const validNext = RIDE_STATUS_EVENT_PROGRESSION[lastEvent] || [];
  
  if (!validNext.includes(newEvent)) {
    throw new StateTransitionError(
      'RideStatusEvent',
      lastEvent,
      newEvent,
      'No regression allowed in ride progress'
    );
  }
  
  logger.debug('RideStatusEvent progression validated', {
    lastEvent,
    newEvent,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if status is terminal (no further transitions possible)
 */
export function isTerminalStatus(
  entity: 'Need' | 'Availability' | 'OfferRequest' | 'RideSession',
  status: string
): boolean {
  const transitions = {
    Need: NEED_TRANSITIONS,
    Availability: AVAILABILITY_TRANSITIONS,
    OfferRequest: OFFER_REQUEST_TRANSITIONS,
    RideSession: RIDE_SESSION_TRANSITIONS,
  };
  
  const entityTransitions = transitions[entity];
  const statusKey = status as keyof typeof entityTransitions;
  
  return entityTransitions[statusKey]?.length === 0;
}

/**
 * Get valid next states for current state
 */
export function getValidNextStates(
  entity: 'Need' | 'Availability' | 'OfferRequest' | 'RideSession',
  currentStatus: string
): string[] {
  const transitions = {
    Need: NEED_TRANSITIONS,
    Availability: AVAILABILITY_TRANSITIONS,
    OfferRequest: OFFER_REQUEST_TRANSITIONS,
    RideSession: RIDE_SESSION_TRANSITIONS,
  };
  
  const entityTransitions = transitions[entity];
  const statusKey = currentStatus as keyof typeof entityTransitions;
  
  return entityTransitions[statusKey] || [];
}

/**
 * Determine RideSession status from RideStatusEvents
 * This is the derived state based on events
 */
export function deriveRideSessionStatus(
  events: RideStatusEventType[]
): RideSessionStatus {
  if (events.length === 0) {
    return RideSessionStatus.ASSIGNED;
  }
  
  // Filter out DELAYED (informational only)
  const progressEvents = events.filter(e => e !== RideStatusEventType.DELAYED);
  
  if (progressEvents.includes(RideStatusEventType.DROPPED_OFF)) {
    return RideSessionStatus.COMPLETED;
  }
  
  if (
    progressEvents.includes(RideStatusEventType.ARRIVED) ||
    progressEvents.includes(RideStatusEventType.PICKED_UP)
  ) {
    return RideSessionStatus.IN_PROGRESS;
  }
  
  return RideSessionStatus.ASSIGNED;
}

/**
 * Check if RideSession should trigger Care Credit issuance
 */
export function shouldIssueCareCredit(status: RideSessionStatus): boolean {
  return status === RideSessionStatus.COMPLETED;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const StateMachine = {
  Need: {
    validate: validateNeedTransition,
    isTerminal: (status: NeedStatus) => isTerminalStatus('Need', status),
    getValidNext: (status: NeedStatus) => getValidNextStates('Need', status),
  },
  Availability: {
    validate: validateAvailabilityTransition,
    isTerminal: (status: AvailabilityStatus) => isTerminalStatus('Availability', status),
    getValidNext: (status: AvailabilityStatus) => getValidNextStates('Availability', status),
  },
  OfferRequest: {
    validate: validateOfferRequestTransition,
    isTerminal: (status: OfferRequestStatus) => isTerminalStatus('OfferRequest', status),
    getValidNext: (status: OfferRequestStatus) => getValidNextStates('OfferRequest', status),
  },
  RideSession: {
    validate: validateRideSessionTransition,
    isTerminal: (status: RideSessionStatus) => isTerminalStatus('RideSession', status),
    getValidNext: (status: RideSessionStatus) => getValidNextStates('RideSession', status),
    deriveFromEvents: deriveRideSessionStatus,
    shouldIssueCareCredit,
  },
  RideStatusEvent: {
    validateProgression: validateRideStatusEventProgression,
  },
};
