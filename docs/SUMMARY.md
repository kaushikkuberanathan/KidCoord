# KidCoord v2 Architecture - Executive Summary

**Date:** February 2, 2026  
**Version:** 2.0  
**Status:** Architecture Defined, Implementation Ready

---

## What Changed

We've refined the KidCoord architecture based on the detailed solution design document you provided. The codebase now includes:

### 1. **Event-Driven, Audit-First Architecture** ✅
- Every meaningful action generates immutable events
- Complete audit trail for safety and trust
- Outbox pattern for reliability (guaranteed notifications and Care Credits)

### 2. **Explicit State Machines** ✅
- **Need**: `OPEN` → `ASSIGNED` → terminal states
- **Availability**: `ACTIVE` → `CLEARED` | `EXPIRED`
- **OfferRequest**: `SENT` → `ACCEPTED` | `DECLINED` | etc.
- **RideSession**: `ASSIGNED` → `IN_PROGRESS` → `COMPLETED`
- **RideStatusEvent**: Append-only timeline (`ARRIVED` → `PICKED_UP` → `DROPPED_OFF`)

### 3. **Refined Data Model** ✅
- **HouseholdMember** with roles (PARENT, DRIVER, HOST, ADMIN)
- Users can belong to multiple households
- **Need**, **Availability**, **OfferRequest** replace simpler RideRequest
- **RideSession** with **RideStatusEvent** timeline
- PII minimization (hashed phone/email, child last initial only)

### 4. **Event-Driven Care Credits** ✅
- **CareCreditEvent**: Immutable, idempotent issuance
- **CareCreditSummary**: Cached aggregate for performance
- **CareCreditPairBalance**: Bilateral relationship (Phase 2)
- Triggered automatically on RideSession completion

### 5. **Idempotency for Mobile Reliability** ✅
- All write endpoints accept `Idempotency-Key` header
- Safe retries on unreliable networks
- 24-hour caching of responses
- Prevents duplicate actions

### 6. **Comprehensive Documentation** ✅
- **API_V2.md**: Complete API specification (50+ endpoints)
- **ARCHITECTURE.md**: System design, patterns, scalability
- **STATE_MACHINE_TESTS.md**: Test matrix with 100+ test cases
- **MIGRATION_GUIDE.md**: Step-by-step code update guide

---

## What You Have Now

### ✅ Complete Foundation
1. **TypeScript Types**: All domain entities with state machines
2. **API Specification**: RESTful endpoints + WebSocket for realtime
3. **Architecture Document**: System design with scalability plan
4. **Test Matrix**: Comprehensive state machine validation
5. **Migration Guide**: How to update existing code

### 📱 React Native App (Partial)

The client shell is locked to this app: fully native React Native 0.73. A hybrid WebView shell is rejected. A PWA or Add-to-Home-Screen page is not binding. Feature work stays parked. See [CLIENT_SHELL.md](./CLIENT_SHELL.md). Cos locked this on November 2, 2026, with the Owner, EL, SA, QA, Hyg, Cost Keeper, and Prioritizer council unanimous on staying with React Native.

1. **Core screens**: Morning Dashboard, Profile
2. **Components**: Button, ChildCard (needs updating)
3. **State management**: Zustand stores (needs updating)
4. **API layer**: HTTP client with retry logic (needs idempotency)

### 📝 What Needs Updating
1. Update stores for new domain types (HouseholdMember, Need, etc.)
2. Refactor components for state machine statuses
3. Add idempotency key generation
4. Create new services (coordinationService, rideSessionService)
5. Update MorningDashboardScreen for new data model

**Estimated Effort**: 20-30 hours (see MIGRATION_GUIDE.md)

---

## Key Architectural Improvements

### 1. Clearer Separation of Concerns
```
v1: RideRequest → Ride
v2: Need → OfferRequest → RideSession → RideStatusEvents

Why: Explicit stages make coordination transparent
```

### 2. Idempotent Operations
```
v1: Retry causes duplicate rides
v2: Retry returns cached response

Why: Mobile networks are unreliable
```

### 3. Event-Driven Care Credits
```
v1: Simple counter, risk of double-counting
v2: Immutable CareCreditEvent, idempotent issuance

Why: Auditability and trust
```

### 4. State Machine Validation
```
v1: Status can change arbitrarily
v2: Transitions validated against state machine

Why: Prevents invalid states, clearer UX
```

### 5. Outbox Pattern
```
v1: Notifications can be lost if service down
v2: OutboxEvent guarantees eventual delivery

Why: Reliability and user trust
```

---

## Data Model Comparison

### v1 (Original)
```
User (email, phone, firstName, lastName)
  ↓
Household (parentIds, childIds)
  ↓
Child (firstName, lastName, schoolId)
  ↓
RideRequest (childId, status)
  ↓
Ride (driverId, childIds, status)
```

### v2 (Refined)
```
User (phoneHash, displayName)
  ↓
HouseholdMember (userId, householdId, roles)
  ↓
Child (firstName, lastInitial)
  ↓
ChildSchoolProfile (schoolId, routeId, stopId)
  ↓
Need (childId, needType, status) ←─┐
Availability (driverId, vehicleId) ──┤
  ↓                                   │
OfferRequest (needId, availabilityId)│
  ↓                                   │
RideSession (needId, driverMemberId) ┘
  ↓
RideStatusEvent (timeline)
  ↓
CareCreditEvent (on COMPLETED)
```

**Benefits:**
- Clearer ownership (HouseholdMember > User)
- Explicit coordination stages (Need → Offer → Session)
- Append-only event log (audit trail)
- Privacy-first (PII minimization)

---

## API Comparison

### v1 Endpoints
```
POST /rides/request           → Create ride request
POST /rides/assign            → Assign driver
POST /rides/status            → Update status
GET  /care-credits            → Get credits
```

### v2 Endpoints (Sample)
```
POST /needs                   → Create need (idempotent)
POST /availability            → Create availability (idempotent)
POST /offer-requests          → Send offer/request (idempotent)
POST /offer-requests/{id}/respond → Accept/decline (atomic)
POST /ride-sessions/{id}/status   → Update status (state machine)
GET  /me/care-credits         → Get CareCreditSummary
```

**Benefits:**
- Idempotency headers prevent duplicates
- State machine validation at API layer
- Atomic operations (accept offer = create session)
- Clear separation of coordination stages

---

## State Machine Example

### Need Status Flow
```
        CREATE NEED
             ↓
        ┌────────┐
        │  OPEN  │ ◄─── Parent signals need
        └────┬───┘
             │
      ┌──────┼───────┐
      │      │       │
ACCEPT OFFER │   PARENT CANCEL
      │      │       │
      ▼      ▼       ▼
 ┌────────┐ ┌────────┐ ┌─────────┐
 │ASSIGNED│ │CANCELLED│ │EXPIRED  │
 │        │ │        │ │(system) │
 └────────┘ └────────┘ └─────────┘
 
 RideSession  (terminal) (terminal)
 created
```

**Constraints Enforced:**
- Can't cancel from `ASSIGNED`
- Only one `OPEN`/`ASSIGNED` per child per date
- Accepting offer creates RideSession atomically
- Other pending offers auto-declined

---

## Care Credits Flow

### Trigger
```
Driver completes ride:
  RideStatusEvent: DROPPED_OFF
       ↓
  RideSession: COMPLETED
       ↓
  CareCreditEvent created (idempotent)
       ↓
  OutboxEvent for async processing
       ↓
  Worker updates CareCreditSummary
       ↓
  Notification sent to driver
```

### Properties
- **Idempotent**: Retry doesn't create duplicate credits
- **Auditable**: Immutable event log
- **Asynchronous**: Doesn't block ride completion
- **Reliable**: Outbox pattern guarantees issuance

---

## Next Steps (Priority Order)

### Immediate (This Week)
1. ✅ Review architecture documents
2. ✅ Understand state machines
3. [ ] Backend: Implement database schema
4. [ ] Backend: Build API endpoints (start with /needs, /availability)
5. [ ] Frontend: Begin migration (follow MIGRATION_GUIDE.md)

### Short-term (Next 2 Weeks)
1. [ ] Backend: Complete coordination endpoints
2. [ ] Backend: Implement state machine validation
3. [ ] Backend: Add idempotency middleware
4. [ ] Frontend: Update stores and services
5. [ ] Frontend: Refactor components
6. [ ] Integration testing

### Medium-term (Next Month)
1. [ ] Outbox pattern implementation
2. [ ] WebSocket for realtime updates
3. [ ] Care Credits issuance on completion
4. [ ] Full state machine test coverage
5. [ ] Load testing

---

## Questions to Resolve

1. **OTP Provider**: Which service? (Twilio, Firebase Auth, custom?)
2. **Push Notifications**: FCM setup, APNs certificates ready?
3. **Database**: PostgreSQL version, hosting (AWS RDS, Google Cloud SQL)?
4. **Queue**: SQS, Pub/Sub, or RabbitMQ for outbox processing?
5. **Registry Import**: How will schools/routes/stops be imported initially?

---

## Success Metrics

### Technical
- [ ] 100% state machine test coverage
- [ ] <200ms p95 API response time
- [ ] Zero duplicate Care Credits
- [ ] <1% idempotency conflicts
- [ ] 99.9% notification delivery

### Product
- [ ] 50% active families in pilot
- [ ] <5 min average match time
- [ ] >4.5/5 parent satisfaction
- [ ] 15+ min time saved per family
- [ ] 25% carline reduction

---

## File Structure Overview

```
kidcoord/
├── API_V2.md                    # Complete API spec (50+ endpoints)
├── ARCHITECTURE.md              # System design document
├── CLIENT_SHELL.md              # Native React Native shell lock
├── STATE_MACHINE_TESTS.md       # Test matrix (100+ tests)
├── MIGRATION_GUIDE.md           # Code update guide
├── CHECKLIST.md                 # Development roadmap
├── README.md                    # Project overview
├── SETUP.md                     # Environment setup
├── QUICKSTART.md                # Get started quickly
│
└── src/
    ├── types/
    │   └── domain.ts            # ✅ UPDATED: v2 types with state machines
    ├── store/                   # ⚠️ NEEDS UPDATE
    ├── services/                # ⚠️ NEEDS UPDATE
    ├── components/              # ⚠️ NEEDS UPDATE
    └── screens/                 # ⚠️ NEEDS UPDATE
```

---

## Recommendation

Feature work stays parked. The options below are the recorded migration plan. They are not an un-park. Dig invents Dig OUT until Cos un-parks. The client shell is already decided. See [CLIENT_SHELL.md](./CLIENT_SHELL.md).

### Option A: Complete Migration First (Recommended)
1. Follow MIGRATION_GUIDE.md step-by-step
2. Update frontend to match v2 architecture
3. Then build backend APIs
4. Benefit: Frontend and backend stay aligned

### Option B: Backend First
1. Build backend APIs per API_V2.md
2. Then migrate frontend to consume new APIs
3. Benefit: Backend can be tested independently

**Suggested**: Option A, because the migration guide is complete and frontend is simpler to iterate on.

---

## Summary

You now have:
✅ **Complete architecture** (event-driven, state machines, idempotency)  
✅ **Comprehensive API spec** (50+ endpoints, WebSocket)  
✅ **Test strategy** (100+ test cases for state machines)  
✅ **Migration path** (step-by-step code update guide)  
✅ **Foundation code** (React Native app, needs updating)

**The architecture record includes a locked client shell** (native React Native 0.73). Feature work stays parked until Cos un-parks. See [CLIENT_SHELL.md](./CLIENT_SHELL.md).

**Estimated timeline recorded with the v2 plan:**
- Frontend migration: 20-30 hours
- Backend implementation: 80-120 hours
- Testing & integration: 40-60 hours
- **Total**: 10-15 weeks with 1-2 engineers

---

**Questions? Start with:**
1. CLIENT_SHELL.md (client shell lock; feature work stays parked)
2. QUICKSTART.md (get the native app running)
3. ARCHITECTURE.md (understand system design)
4. MIGRATION_GUIDE.md (recorded code-update guide)
5. API_V2.md (API specification)

Feature work stays parked until Cos un-parks.
