# State Machine Test Matrix

**Purpose:** Comprehensive test scenarios for all state transitions in KidCoord  
**Version:** 2.0  
**Last Updated:** February 2, 2026

This document provides a systematic test matrix for validating state machine behavior across all entities in the KidCoord system.

---

## 1. Need Status State Machine

### Valid Transitions

| Current Status | Action | Next Status | Test Case |
|---------------|--------|-------------|-----------|
| OPEN | Offer accepted | ASSIGNED | TC-N-001 |
| OPEN | Parent cancels | CANCELLED | TC-N-002 |
| OPEN | Window expires | EXPIRED | TC-N-003 |

### Invalid Transitions (Should Fail)

| Current Status | Invalid Action | Expected Error | Test Case |
|---------------|----------------|----------------|-----------|
| ASSIGNED | Parent tries to cancel | 400 Bad Request | TC-N-004 |
| ASSIGNED | Try to accept another offer | 409 Conflict | TC-N-005 |
| CANCELLED | Try to assign | 400 Bad Request | TC-N-006 |
| EXPIRED | Try to assign | 400 Bad Request | TC-N-007 |
| CANCELLED | Try to reopen | 400 Bad Request | TC-N-008 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Two offers accepted simultaneously | Only one succeeds, other gets 409 | TC-N-009 |
| Need cancelled while offer in-flight | Offer should fail with 400 | TC-N-010 |
| Need expires while offer pending | Offer should fail with 400 | TC-N-011 |

### Constraint Tests

| Constraint | Test Scenario | Expected Result | Test Case |
|-----------|---------------|-----------------|-----------|
| One OPEN/ASSIGNED per child+date | Create duplicate Need | 409 Conflict | TC-N-012 |
| Can't cancel from ASSIGNED | Try PATCH /cancel on ASSIGNED | 400 Bad Request | TC-N-013 |

---

## 2. Availability Status State Machine

### Valid Transitions

| Current Status | Action | Next Status | Test Case |
|---------------|--------|-------------|-----------|
| ACTIVE | Driver clears | CLEARED | TC-A-001 |
| ACTIVE | Window expires | EXPIRED | TC-A-002 |

### Invalid Transitions (Should Fail)

| Current Status | Invalid Action | Expected Error | Test Case |
|---------------|----------------|----------------|-----------|
| CLEARED | Try to re-activate | 400 Bad Request | TC-A-003 |
| EXPIRED | Try to re-activate | 400 Bad Request | TC-A-004 |
| CLEARED | Try to clear again | 400 Bad Request | TC-A-005 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Clear while offers pending | Offers should fail | TC-A-006 |
| Seats exhausted | seatsAvailable = 0, still ACTIVE | TC-A-007 |
| Driver creates overlapping availability | 409 Conflict | TC-A-008 |

### Constraint Tests

| Constraint | Test Scenario | Expected Result | Test Case |
|-----------|---------------|-----------------|-----------|
| No overlapping ACTIVE windows | Create overlapping availability | 409 Conflict | TC-A-009 |
| Seats decrement on assignment | Accept offer, check seatsAvailable | Decrements by 1 | TC-A-010 |

---

## 3. OfferRequest Status State Machine

### Valid Transitions

| Current Status | Action | Next Status | Test Case |
|---------------|--------|-------------|-----------|
| SENT | Recipient accepts | ACCEPTED | TC-O-001 |
| SENT | Recipient declines | DECLINED | TC-O-002 |
| SENT | Sender cancels | CANCELLED | TC-O-003 |
| SENT | Window expires | EXPIRED | TC-O-004 |

### Invalid Transitions (Should Fail)

| Current Status | Invalid Action | Expected Error | Test Case |
|---------------|----------------|----------------|-----------|
| ACCEPTED | Try to decline | 400 Bad Request | TC-O-005 |
| DECLINED | Try to accept | 400 Bad Request | TC-O-006 |
| CANCELLED | Try to accept | 400 Bad Request | TC-O-007 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Accept while Need becomes unavailable | 400 Bad Request | TC-O-008 |
| Two people accept same offer | One succeeds, other fails | TC-O-009 |
| Accept creates RideSession atomically | RideSession exists or rollback | TC-O-010 |
| Other pending offers auto-declined | Other offers DECLINED | TC-O-011 |

### Constraint Tests

| Constraint | Test Scenario | Expected Result | Test Case |
|-----------|---------------|-----------------|-----------|
| Only one ACCEPTED per Need | Accept second offer for Need | 409 Conflict | TC-O-012 |
| Atomic RideSession creation | Partial failure rolls back | All or nothing | TC-O-013 |

---

## 4. RideSession Status State Machine

### Valid Transitions

| Current Status | Action | Next Status | Test Case |
|---------------|--------|-------------|-----------|
| ASSIGNED | Driver records ARRIVED/PICKED_UP | IN_PROGRESS | TC-R-001 |
| IN_PROGRESS | Driver records DROPPED_OFF | COMPLETED | TC-R-002 |
| ASSIGNED | Admin/driver cancels | CANCELLED | TC-R-003 |
| IN_PROGRESS | Admin/driver cancels | CANCELLED | TC-R-004 |

### Invalid Transitions (Should Fail)

| Current Status | Invalid Action | Expected Error | Test Case |
|---------------|----------------|----------------|-----------|
| COMPLETED | Try to cancel | 400 Bad Request | TC-R-005 |
| CANCELLED | Try to start | 400 Bad Request | TC-R-006 |
| COMPLETED | Try to add status event | 400 Bad Request | TC-R-007 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Complete without PICKED_UP event | Should fail, require progression | TC-R-008 |
| Multiple ARRIVED events | Should succeed, append-only | TC-R-009 |
| DELAYED event while IN_PROGRESS | Should succeed, informational | TC-R-010 |

### Constraint Tests

| Constraint | Test Scenario | Expected Result | Test Case |
|-----------|---------------|-----------------|-----------|
| COMPLETED requires DROPPED_OFF | Try to complete without event | 400 Bad Request | TC-R-011 |
| Cancel emits AuditEvent | Cancel session, check audit log | AuditEvent exists | TC-R-012 |

---

## 5. RideStatusEvent Progression

### Valid Event Sequences

| Previous Event | Next Event | Valid? | Test Case |
|---------------|-----------|--------|-----------|
| (none) | ARRIVED | ✓ | TC-E-001 |
| ARRIVED | PICKED_UP | ✓ | TC-E-002 |
| PICKED_UP | DROPPED_OFF | ✓ | TC-E-003 |
| (any) | DELAYED | ✓ | TC-E-004 |
| ARRIVED | DROPPED_OFF | ✓ (skip allowed) | TC-E-005 |

### Invalid Event Sequences

| Previous Event | Next Event | Valid? | Expected Error | Test Case |
|---------------|-----------|--------|----------------|-----------|
| PICKED_UP | ARRIVED | ✗ | 400 Bad Request | TC-E-006 |
| DROPPED_OFF | PICKED_UP | ✗ | 400 Bad Request | TC-E-007 |
| DROPPED_OFF | ARRIVED | ✗ | 400 Bad Request | TC-E-008 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Multiple DELAYED events | All succeed, append-only | TC-E-009 |
| DROPPED_OFF triggers Care Credit | CareCreditEvent created | TC-E-010 |
| Event with geo coordinates | Stores lat/lng | TC-E-011 |

---

## 6. Care Credits Issuance

### Trigger Conditions

| Condition | Should Issue Credit? | Test Case |
|-----------|---------------------|-----------|
| RideSession → COMPLETED | ✓ Yes | TC-CC-001 |
| RideSession → CANCELLED | ✗ No | TC-CC-002 |
| DROPPED_OFF event recorded | ✓ Yes (via COMPLETED) | TC-CC-003 |

### Idempotency Tests

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Complete same ride twice | Only one CareCreditEvent | TC-CC-004 |
| Duplicate Idempotency-Key | Returns cached response | TC-CC-005 |
| Same contextId + actorMemberId | Returns existing event | TC-CC-006 |

### Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Complete ride, cancel later | Credit remains (no clawback) | TC-CC-007 |
| OutboxEvent fails | Retry until processed | TC-CC-008 |
| Summary update fails | Event still created | TC-CC-009 |

---

## 7. Idempotency Testing

### Same Key, Same Request

| Attempt | Expected Response | Test Case |
|---------|------------------|-----------|
| First | 201 Created | TC-I-001 |
| Second (within 24h) | 200 OK (cached) | TC-I-002 |
| Third (after 24h) | 201 Created (new) | TC-I-003 |

### Same Key, Different Request

| Attempt | Expected Response | Test Case |
|---------|------------------|-----------|
| First | 201 Created | TC-I-004 |
| Second (different body) | 409 Conflict | TC-I-005 |

### Concurrency Tests

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Two requests, same key, simultaneous | One succeeds, one gets cached | TC-I-006 |
| Two requests, different keys, same Need | One succeeds, one gets 409 | TC-I-007 |

---

## 8. Multi-Entity Flow Tests

### Complete Happy Path

```
Test Case: TC-F-001 - Complete Drop-Off Flow
1. Create Need → OPEN
2. Create Availability → ACTIVE
3. Send OfferRequest → SENT
4. Accept OfferRequest → ACCEPTED
   - Need → ASSIGNED
   - RideSession created → ASSIGNED
   - Other offers → DECLINED
5. Record ARRIVED → RideSession stays ASSIGNED, event appended
6. Record PICKED_UP → RideSession → IN_PROGRESS
7. Record DROPPED_OFF → RideSession → COMPLETED
   - CareCreditEvent created
   - CareCreditSummary updated
   - Notification sent
```

### Cancellation Scenarios

```
Test Case: TC-F-002 - Parent Cancels Before Match
1. Create Need → OPEN
2. Cancel Need → CANCELLED
3. Try to send OfferRequest → 400 Bad Request

Test Case: TC-F-003 - Driver Cancels After Assignment
1. Need ASSIGNED, RideSession ASSIGNED
2. Driver cancels RideSession → CANCELLED
3. Need should remain ASSIGNED (admin must reassign)
4. AuditEvent created
5. Notification sent to parent
```

### Race Condition Tests

```
Test Case: TC-F-004 - Two Drivers Accept Simultaneously
1. Need OPEN, two pending OfferRequests
2. Both accept at same time
3. Database constraint ensures only one succeeds
4. Second gets 409 Conflict
5. Loser's offer marked DECLINED

Test Case: TC-F-005 - Need Expires During Accept
1. OfferRequest SENT, Need near expiration
2. Need expires (system job)
3. Accept attempt should fail with 400
```

---

## 9. Database Constraint Tests

### Uniqueness Constraints

| Entity | Constraint | Test Scenario | Expected Result | Test Case |
|--------|-----------|---------------|-----------------|-----------|
| Need | child_id + date + status (OPEN/ASSIGNED) | Create duplicate | 409 Conflict | TC-D-001 |
| Availability | driver + date + overlapping window | Create overlap | 409 Conflict | TC-D-002 |
| OfferRequest | need_id + status (ACCEPTED) | Accept twice | 409 Conflict | TC-D-003 |
| CareCreditEvent | contextId + actorMemberId + eventType | Issue twice | Returns existing | TC-D-004 |

### Foreign Key Constraints

| Entity | FK Constraint | Test Scenario | Expected Result | Test Case |
|--------|--------------|---------------|-----------------|-----------|
| Need | childId | Create with invalid child | 404 Not Found | TC-D-005 |
| Availability | vehicleId | Create with invalid vehicle | 404 Not Found | TC-D-006 |
| OfferRequest | needId, availabilityId | Invalid references | 404 Not Found | TC-D-007 |

---

## 10. Audit Event Tests

### Events Generated

| Action | AuditEventType | Test Case |
|--------|---------------|-----------|
| Create Need | NEED_CREATED | TC-AE-001 |
| Cancel Need | NEED_CANCELLED | TC-AE-002 |
| Accept Offer | OFFER_REQUEST_ACCEPTED | TC-AE-003 |
| Complete Ride | RIDE_SESSION_COMPLETED | TC-AE-004 |
| Block Driver | DRIVER_BLOCKED | TC-AE-005 |
| Issue Credit | CARE_CREDIT_ISSUED | TC-AE-006 |
| Admin Override | ADMIN_OVERRIDE | TC-AE-007 |

### Audit Event Properties

| Test | Expected | Test Case |
|------|----------|-----------|
| actorUserId populated | ✓ | TC-AE-008 |
| timestamp accurate | ✓ | TC-AE-009 |
| metadata includes details | ✓ | TC-AE-010 |
| integrityHash computed | ✓ (if enabled) | TC-AE-011 |

---

## Test Execution Guide

### Priority Levels

- **P0 (Critical)**: Must pass before release
  - All valid state transitions
  - Idempotency on writes
  - Care Credits issuance
  - Constraint enforcement

- **P1 (High)**: Should pass before release
  - Edge cases
  - Race conditions
  - Error messages

- **P2 (Medium)**: Nice to have
  - Performance tests
  - Audit event completeness

### Automated Test Structure

```typescript
describe('Need Status State Machine', () => {
  describe('Valid Transitions', () => {
    test('TC-N-001: OPEN → ASSIGNED when offer accepted', async () => {
      const need = await createNeed({ status: 'OPEN' });
      const availability = await createAvailability();
      const offer = await createOfferRequest({ needId: need.id });
      
      await acceptOffer(offer.id);
      
      const updated = await getNeed(need.id);
      expect(updated.status).toBe('ASSIGNED');
    });
  });
  
  describe('Invalid Transitions', () => {
    test('TC-N-004: Cannot cancel ASSIGNED need', async () => {
      const need = await createNeed({ status: 'ASSIGNED' });
      
      await expect(cancelNeed(need.id))
        .rejects
        .toThrow('Cannot transition from ASSIGNED to CANCELLED');
    });
  });
});
```

---

## Manual Test Checklist

For QA testers, use this checklist to verify state machines manually:

### Need Lifecycle
- [ ] TC-N-001: Create Need → OPEN
- [ ] TC-N-002: Cancel Need → CANCELLED
- [ ] TC-N-003: Need expires → EXPIRED
- [ ] TC-N-004: Cannot cancel ASSIGNED
- [ ] TC-N-009: Concurrent offer acceptance

### Availability Lifecycle
- [ ] TC-A-001: Clear availability → CLEARED
- [ ] TC-A-002: Availability expires → EXPIRED
- [ ] TC-A-008: Cannot create overlapping windows

### OfferRequest Lifecycle
- [ ] TC-O-001: Accept offer → ACCEPTED
- [ ] TC-O-002: Decline offer → DECLINED
- [ ] TC-O-010: RideSession created atomically
- [ ] TC-O-011: Other offers declined

### RideSession Lifecycle
- [ ] TC-R-001: Start ride → IN_PROGRESS
- [ ] TC-R-002: Complete ride → COMPLETED
- [ ] TC-R-003: Cancel ride → CANCELLED
- [ ] TC-E-010: DROPPED_OFF triggers Care Credit

### Care Credits
- [ ] TC-CC-001: Credit issued on COMPLETED
- [ ] TC-CC-004: Idempotent issuance
- [ ] TC-CC-007: No clawback on cancel

---

**Last Updated:** February 2, 2026  
**Version:** 2.0
