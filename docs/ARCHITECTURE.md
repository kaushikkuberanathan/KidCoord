# KidCoord Architecture Documentation

**Version:** 2.0  
**Last Updated:** February 2, 2026

## Architecture Overview

KidCoord is built with an **event-driven, audit-first architecture** designed for:
- Mobile reliability (idempotent writes, offline support)
- Safety and trust (immutable audit logs, blocklist enforcement)
- Scalability (horizontal build, modular expansion)
- Transparency (every action logged and traceable)

---

## Design Goals

1. **MVP-Tight**: Only what School Drop-Off needs, but structured for future products
2. **Event/Audit-First**: Every meaningful action generates an immutable event
3. **Separation of Concerns**: Clean domain boundaries
4. **Realtime-Friendly**: State transitions work without polling
5. **Idempotent Writes**: Mobile networks are unreliable; endpoints must be safe to retry
6. **PII Minimization**: Store only what's required

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Clients                          │
│               (iOS, Android, Mobile Web)                    │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                            │
│         (Authentication, Rate Limiting, Routing)            │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth Service │  │ Coordination │  │ Trust Service│     │
│  │              │  │   Service    │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Notification  │  │ Contribution │  │Admin Service │     │
│  │  Service     │  │   Service    │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │    Redis     │  │Event Queue   │     │
│  │  (Primary DB)│  │   (Cache)    │  │ (SQS/PubSub) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  External Services                          │
│     FCM/APNs (Push)   │   OTP Provider   │  Analytics      │
└─────────────────────────────────────────────────────────────┘
```

---

## Domain Model

### Separation of Concerns

The data model is organized into **8 distinct domains**:

#### A. Identity & Access
- **User**: Core identity (phone/email hashed, display name)
- **Session**: Authentication tokens
- **Household**: Family unit
- **HouseholdMember**: User's membership in household with roles

**Key Principle**: Users can be members of multiple households

#### B. Household Setup
- **Child**: Belongs to household, PII minimized (last initial only)
- **ChildSchoolProfile**: Links child to school, route, stop
- **Vehicle**: Household's vehicle with seat capacity
- **VehicleDriver**: Maps drivers to vehicles

**Key Principle**: Clear ownership and capacity tracking

#### C. Registry (Admin-Managed)
- **School**: Educational institution
- **Route**: Bus/carpool route
- **Stop**: Pickup/dropoff location
- **Community**: Neighborhood grouping
- **RegistryVersion**: Version tracking for registry changes

**Key Principle**: Registry is stable, admin-controlled metadata

#### D. Coordination Engine
- **Need**: Child needs something (drop-off, pickup, hosting)
- **Availability**: Driver can help at a time/place
- **OfferRequest**: Connects Need with Availability
- **RideSession**: Execution unit (created when offer accepted)
- **RideParticipant**: Tracks roles in session
- **RideStatusEvent**: Append-only timeline of ride progress

**Key Principle**: State machines enforce valid transitions

#### E. Care Credits (Contribution Tracking)
- **CareCreditEvent**: Immutable record of contribution
- **CareCreditSummary**: Cached aggregate for performance
- **CareCreditPairBalance**: Bilateral relationship (Phase 2)

**Key Principle**: Event-driven, passive tracking, no penalties

#### F. Safety & Trust
- **Blocklist**: Child-level driver exclusion
- **Verification**: User verification status

**Key Principle**: Privacy-first, parent-controlled

#### G. Notifications + Realtime
- **NotificationPreference**: Per-category settings
- **Notification**: Individual notification record
- **OutboxEvent**: Reliability pattern for async delivery

**Key Principle**: Guaranteed delivery, no lost notifications

#### H. Audit + Observability
- **AuditEvent**: Immutable log of all actions
- **IdempotencyKey**: Prevents duplicate requests

**Key Principle**: Complete traceability, tamper-evident

---

## State Machines

### Need Status
```
        ┌──────┐
        │ OPEN │ ◄─── Created when parent signals need
        └───┬──┘
            │
    ┌───────┼────────┐
    │       │        │
    ▼       ▼        ▼
┌────────┐ ┌────────┐ ┌─────────┐
│ASSIGNED│ │CANCELLED│ │EXPIRED  │
│(terminal)│(terminal)│(terminal)│
└────────┘ └────────┘ └─────────┘
```

**Constraints:**
- Only one `OPEN` or `ASSIGNED` Need per child per date
- `CANCELLED` only from `OPEN`
- `EXPIRED` is system-driven after window ends
- `ASSIGNED` created when RideSession is confirmed

### Availability Status
```
        ┌────────┐
        │ ACTIVE │ ◄─── Created when driver signals availability
        └───┬────┘
            │
        ┌───┴────┐
        │        │
        ▼        ▼
    ┌────────┐ ┌─────────┐
    │CLEARED │ │EXPIRED  │
    │(terminal)│(terminal)│
    └────────┘ └─────────┘
```

**Constraints:**
- No overlapping `ACTIVE` windows per driver per date
- `EXPIRED` is system-driven after window ends

### OfferRequest Status
```
        ┌──────┐
        │ SENT │ ◄─── Created when offer/request made
        └───┬──┘
            │
    ┌───────┼─────────┬──────────┐
    │       │         │          │
    ▼       ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ACCEPTED│ │DECLINED│ │EXPIRED │ │CANCELLED│
│(terminal)│(terminal)│(terminal)│(terminal)│
└────────┘ └────────┘ └────────┘ └─────────┘
```

**Constraints:**
- Accepting creates RideSession **atomically**
- Only one `ACCEPTED` OfferRequest per Need
- Other pending offers auto-declined when one is accepted

### RideSession Status
```
        ┌──────────┐
        │ ASSIGNED │ ◄─── Created when offer accepted
        └─────┬────┘
              │
              ▼
        ┌─────────────┐
        │ IN_PROGRESS │ ◄─── Started when ARRIVED or PICKED_UP
        └─────┬───────┘
              │
          ┌───┴────┐
          │        │
          ▼        ▼
      ┌────────┐ ┌─────────┐
      │COMPLETED│ │CANCELLED│
      │(terminal)│(terminal)│
      └────────┘ └─────────┘
```

**Constraints:**
- `IN_PROGRESS` begins at first `ARRIVED` or `PICKED_UP` event
- `COMPLETED` requires `DROPPED_OFF` event
- Cancelling emits AuditEvent and notifications

### RideStatusEvent Progression
```
Append-only timeline (no transitions, only additions)

        ┌─────────┐
        │ ARRIVED │
        └────┬────┘
             │
             ▼
        ┌───────────┐
        │ PICKED_UP │
        └─────┬─────┘
              │
              ▼
        ┌────────────┐
        │ DROPPED_OFF│ ◄─── Triggers Care Credit
        └────────────┘

        ┌─────────┐
        │ DELAYED │ ◄─── Can occur anytime
        └─────────┘
```

**Constraints:**
- No regression (can't go backward)
- `DELAYED` is informational, doesn't advance state
- `DROPPED_OFF` triggers Care Credit issuance

---

## Care Credits System

### Issuance Rule (MVP)

**Trigger:** RideSession transitions to `COMPLETED`

**Action:**
1. Insert `CareCreditEvent` with uniqueness guard
   - `contextId` + `actorMemberId` + `eventType` must be unique
   - Idempotent: duplicate attempts return existing record
2. Update `CareCreditSummary` (async via OutboxEvent)
3. Send notification (optional, in-app only for MVP)

**Example Flow:**
```
1. Driver records DROPPED_OFF status
2. RideSession → COMPLETED
3. System creates CareCreditEvent:
   - actorMemberId: driver_member_id
   - beneficiaryMemberId: parent_member_id
   - contextType: RIDE_SESSION
   - contextId: session_id
   - units: 1
4. OutboxEvent created for async processing
5. Worker updates CareCreditSummary
6. Notification sent: "You earned a Care Credit!"
```

### Display Logic

**Profile View (Self):**
- Total credits earned
- Breakdown by event type (RIDE_COMPLETED, etc.)
- Recent contributions

**Profile View (Other):**
- Total credits visible (public)
- No detailed history (privacy)
- Reliability indicators (completion rate, on-time rate)

**Bilateral View (Phase 2):**
- Private, contextual
- "John has helped you 3 more times than you've helped them"
- Soft cues like "You're up next to help"

---

## API Design Principles

### 1. Idempotency

All write endpoints require `Idempotency-Key` header:
- Prevents duplicate actions on retry
- Cache responses for 24 hours
- Returns 409 if same key + different body

**Implementation:**
```sql
CREATE TABLE idempotency_keys (
  key VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  route VARCHAR NOT NULL,
  request_hash VARCHAR NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
```

### 2. State Machine Validation

All status changes validated against state machine:
```typescript
function validateNeedTransition(current: NeedStatus, next: NeedStatus) {
  const validTransitions = {
    OPEN: ['ASSIGNED', 'CANCELLED', 'EXPIRED'],
    ASSIGNED: [], // Terminal
    CANCELLED: [], // Terminal
    EXPIRED: [], // Terminal
  };
  
  if (!validTransitions[current]?.includes(next)) {
    throw new StateTransitionError(`Cannot transition from ${current} to ${next}`);
  }
}
```

### 3. Atomic Operations

Critical operations use database transactions:
```typescript
// Accept offer (atomic)
await db.transaction(async (trx) => {
  // 1. Update OfferRequest
  await trx('offer_requests')
    .where('id', offerRequestId)
    .update({ status: 'ACCEPTED' });
  
  // 2. Update Need
  await trx('needs')
    .where('id', needId)
    .update({ status: 'ASSIGNED' });
  
  // 3. Create RideSession
  const session = await trx('ride_sessions').insert({...});
  
  // 4. Decline other pending offers
  await trx('offer_requests')
    .where('need_id', needId)
    .whereNot('id', offerRequestId)
    .update({ status: 'DECLINED' });
  
  // 5. Create OutboxEvents for notifications
  await trx('outbox_events').insert([...]);
});
```

### 4. Outbox Pattern

Guarantees async operations (notifications, Care Credits):
```typescript
// After RideSession completed
await db.transaction(async (trx) => {
  // Update session
  await trx('ride_sessions')
    .where('id', sessionId)
    .update({ session_status: 'COMPLETED', completed_at: now() });
  
  // Create OutboxEvents
  await trx('outbox_events').insert([
    {
      event_type: 'CARE_CREDIT_ISSUE',
      entity_type: 'RIDE_SESSION',
      entity_id: sessionId,
      payload: { driver_member_id, ... },
      status: 'PENDING'
    },
    {
      event_type: 'NOTIFICATION_SEND',
      entity_type: 'NOTIFICATION',
      entity_id: notificationId,
      payload: { user_id, title, body },
      status: 'PENDING'
    }
  ]);
});

// Separate worker processes OutboxEvents
async function processOutbox() {
  const events = await db('outbox_events')
    .where('status', 'PENDING')
    .orderBy('created_at')
    .limit(100);
  
  for (const event of events) {
    try {
      await processEvent(event);
      await db('outbox_events')
        .where('id', event.id)
        .update({ status: 'PROCESSED', processed_at: now() });
    } catch (error) {
      await db('outbox_events')
        .where('id', event.id)
        .update({ status: 'FAILED' });
    }
  }
}
```

---

## Matching Engine

### Eligibility Filters (Deterministic Order)

1. **Date + Time Overlap**
   ```typescript
   availability.windowStartAt <= need.windowEndAt &&
   availability.windowEndAt >= need.windowStartAt
   ```

2. **Capacity Remaining**
   ```typescript
   availability.seatsAvailable > 0
   ```

3. **Route/Stop Preference Match** (if provided)
   ```typescript
   !availability.preferenceRouteId ||
   availability.preferenceRouteId === childSchoolProfile.routeId
   ```

4. **Blocklist Exclusion**
   ```typescript
   !blocklist.find(b => 
     b.childId === need.childId && 
     b.blockedHouseholdMemberId === availability.householdMemberId &&
     b.status === 'active'
   )
   ```

5. **Role Eligibility**
   ```typescript
   householdMember.roles.includes('DRIVER')
   ```

### Match Metadata

Store "why matched" for UX explanation:
```json
{
  "matched": true,
  "reasons": [
    "Time window overlaps",
    "Has 2 seats available",
    "Same route preference"
  ],
  "distance": 1.5,
  "estimatedPickupTime": "07:15:00"
}
```

---

## Security & Privacy

### PII Minimization
- Phone/email: Store hashed + normalized, keep encrypted raw only if needed for OTP
- Child: Only first name + last initial
- Location: Rounded to stop level, not exact coordinates

### RBAC (Role-Based Access Control)
- Household-scoped: Users can only access their household data
- Role-based: PARENT, DRIVER, HOST roles with specific permissions
- Admin: Separate admin flag for platform-wide access

### Audit Integrity
- Every action logged with actor, timestamp, metadata
- Optional integrity hash for tamper detection
- IP hash stored (not raw IP) for privacy

### Encryption
- Database: Encrypt sensitive columns at rest
- Transit: TLS 1.3 for all API communication
- Tokens: JWT with short expiration, refresh token rotation

---

## Observability

### Metrics to Track

**Coordination:**
- Needs created per day
- Average time to match
- Offer acceptance rate
- Ride completion rate

**Care Credits:**
- Credits issued per day
- Distribution across members
- Bilateral balance trends

**Performance:**
- API response times (p50, p95, p99)
- Database query times
- WebSocket connection count
- Outbox processing lag

**Safety:**
- Blocklist additions per week
- Admin overrides
- Failed state transitions

### Logging

Structured JSON logs with correlation IDs:
```json
{
  "timestamp": "2026-02-02T10:00:00Z",
  "level": "INFO",
  "requestId": "req_123",
  "userId": "user_456",
  "action": "OFFER_ACCEPTED",
  "entityType": "OFFER_REQUEST",
  "entityId": "offer_789",
  "duration_ms": 45
}
```

---

## Scalability Considerations

### MVP (0-10k users)
- Monolithic Node.js/Python backend
- Single PostgreSQL instance
- Redis for registry cache
- SQS/PubSub for outbox processing

### Growth (10k-100k users)
- Separate services (coordination, notifications, contribution)
- Read replicas for PostgreSQL
- Redis cluster for cache + realtime fanout
- Dedicated worker pool for outbox

### Scale (100k+ users)
- Microservices with API gateway
- Database sharding by household/community
- Event streaming (Kafka)
- CDN for static assets
- Multi-region deployment

---

## Technology Stack

### Backend
- **Language**: Node.js (TypeScript) or Python (FastAPI)
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Queue**: AWS SQS or Google Pub/Sub
- **Push**: FCM (Android) + APNs (iOS)

### Frontend (React Native)
- **Framework**: React Native 0.73
- **Language**: TypeScript 5.0
- **State**: Zustand
- **Navigation**: React Navigation 6
- **API**: Fetch with retry logic

### DevOps
- **Hosting**: AWS or GCP
- **CI/CD**: GitHub Actions
- **Monitoring**: DataDog or New Relic
- **Errors**: Sentry
- **Analytics**: Mixpanel or Amplitude

---

## Testing Strategy

### Unit Tests
- State machine transitions
- Matching engine logic
- Care Credits issuance rules
- API service methods

### Integration Tests
- Complete user flows
- Database transactions
- Outbox processing
- WebSocket connections

### E2E Tests
- Critical paths (need → offer → ride → completion)
- Error scenarios (declined offers, cancellations)
- Concurrent operations (multiple users)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Server Cluster                        │
│         (Auto-scaling, Health Checks, Circuit Breakers)     │
└─────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Cluster                         │
│    Primary (Write) + Read Replicas + Connection Pooling    │
└─────────────────────────────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
            ┌──────────────┐  ┌──────────────┐
            │ Redis Cluster│  │Worker Cluster│
            │   (Cache)    │  │  (Outbox)    │
            └──────────────┘  └──────────────┘
```

---

**Last Updated:** February 2, 2026  
**Version:** 2.0 (Architecture-Aligned)
