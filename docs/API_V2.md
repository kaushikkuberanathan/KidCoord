# KidCoord API v2 - Architecture-Aligned Specification

**Version:** 2.0  
**Last Updated:** February 2, 2026  
**Architecture:** Event-driven, idempotent, audit-first

## Core Principles

1. **Idempotent Writes**: All write endpoints accept `Idempotency-Key` header
2. **Event-Driven**: State changes emit events (audit, notifications, Care Credits)
3. **State Machines**: Explicit status transitions with validation
4. **PII Minimization**: Store only what's required (phone/email hashed, child last initial only)
5. **Mobile-First**: Designed for unreliable networks and offline scenarios

---

## Base URL & Authentication

```
Development: http://localhost:3000/api/v2
Production: https://api.kidcoord.com/api/v2
```

**Authentication:** All requests (except `/auth/*`) require:
```
Authorization: Bearer {token}
```

**Idempotency:** All write requests should include:
```
Idempotency-Key: {unique-client-generated-uuid}
```

**Response Format:** All responses include:
```json
{
  "requestId": "req_abc123",
  "timestamp": "2026-02-02T10:00:00Z",
  "data": { /* response payload */ }
}
```

---

## 1. Authentication & Session

### POST /auth/otp/request
Request OTP for phone-based authentication.

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "requestId": "req_001",
  "data": {
    "otpRequestId": "otp_abc123",
    "expiresAt": "2026-02-02T10:05:00Z"
  }
}
```

### POST /auth/otp/verify
Verify OTP and create session.

**Request:**
```json
{
  "otpRequestId": "otp_abc123",
  "code": "123456",
  "deviceId": "device_xyz" 
}
```

**Response (200):**
```json
{
  "requestId": "req_002",
  "data": {
    "user": {
      "id": "user_123",
      "displayName": "Jane Doe",
      "status": "active",
      "isAdmin": false
    },
    "session": {
      "id": "session_456",
      "token": "eyJhbGc...",
      "expiresAt": "2026-03-02T10:00:00Z"
    },
    "households": [
      {
        "id": "household_789",
        "name": "Doe Family",
        "memberRole": ["PARENT", "DRIVER"]
      }
    ]
  }
}
```

### GET /auth/session
Bootstrap app state (called on app launch).

**Response (200):**
```json
{
  "requestId": "req_003",
  "data": {
    "user": { /* User object */ },
    "households": [ /* Household memberships */ ],
    "registryVersion": "2026.02.01"
  }
}
```

### POST /auth/logout
Revoke current session.

**Response (200):**
```json
{
  "requestId": "req_004",
  "data": {
    "success": true
  }
}
```

---

## 2. Household & Children

### GET /households/{householdId}
Get household details.

**Response (200):**
```json
{
  "requestId": "req_005",
  "data": {
    "household": {
      "id": "household_789",
      "name": "Doe Family",
      "status": "active"
    },
    "members": [
      {
        "id": "member_123",
        "userId": "user_123",
        "displayName": "Jane Doe",
        "roles": ["PARENT", "DRIVER"],
        "status": "active"
      }
    ],
    "children": [
      {
        "id": "child_456",
        "firstName": "Emma",
        "lastInitial": "D",
        "schoolProfiles": [
          {
            "schoolId": "school_001",
            "routeId": "route_101",
            "stopId": "stop_201",
            "isPrimary": true
          }
        ]
      }
    ],
    "vehicles": [
      {
        "id": "vehicle_789",
        "label": "Honda CR-V",
        "seatCapacity": 4,
        "drivers": ["member_123"]
      }
    ]
  }
}
```

### POST /households/{householdId}/children
Add child to household.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "firstName": "Emma",
  "lastInitial": "D",
  "schoolId": "school_001",
  "routeId": "route_101",
  "stopId": "stop_201"
}
```

**Response (201):**
```json
{
  "requestId": "req_006",
  "data": {
    "child": {
      "id": "child_456",
      "householdId": "household_789",
      "firstName": "Emma",
      "lastInitial": "D",
      "status": "active"
    },
    "schoolProfile": {
      "id": "profile_999",
      "childId": "child_456",
      "schoolId": "school_001",
      "routeId": "route_101",
      "stopId": "stop_201",
      "isPrimary": true
    }
  }
}
```

---

## 3. Needs (Coordination)

### POST /needs
Create a need for a child.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "childId": "child_456",
  "needType": "DROP_OFF",
  "date": "2026-02-03",
  "windowStartAt": "2026-02-03T07:00:00Z",
  "windowEndAt": "2026-02-03T07:30:00Z"
}
```

**State Machine:** Creates Need in `OPEN` status

**Response (201):**
```json
{
  "requestId": "req_007",
  "data": {
    "need": {
      "id": "need_123",
      "householdId": "household_789",
      "childId": "child_456",
      "needType": "DROP_OFF",
      "date": "2026-02-03",
      "windowStartAt": "2026-02-03T07:00:00Z",
      "windowEndAt": "2026-02-03T07:30:00Z",
      "status": "OPEN",
      "createdByMemberId": "member_123"
    }
  }
}
```

**Constraints:**
- Only one `OPEN` or `ASSIGNED` Need per child per date
- Returns 409 Conflict if constraint violated

### PATCH /needs/{needId}/cancel
Cancel an open need.

**Headers:**
```
Idempotency-Key: {uuid}
```

**State Machine:** `OPEN` → `CANCELLED`

**Response (200):**
```json
{
  "requestId": "req_008",
  "data": {
    "need": {
      "id": "need_123",
      "status": "CANCELLED",
      "updatedAt": "2026-02-02T10:15:00Z"
    }
  }
}
```

**Errors:**
- 400: Cannot cancel from `ASSIGNED` status
- 404: Need not found

### GET /needs
Query needs with filters.

**Query Parameters:**
- `householdId` (required)
- `date` (optional, YYYY-MM-DD)
- `status` (optional, comma-separated)
- `childId` (optional)

**Response (200):**
```json
{
  "requestId": "req_009",
  "data": {
    "needs": [
      {
        "id": "need_123",
        "child": { /* Child object */ },
        "status": "OPEN",
        "windowStartAt": "2026-02-03T07:00:00Z",
        "windowEndAt": "2026-02-03T07:30:00Z"
      }
    ]
  }
}
```

---

## 4. Availability

### POST /availability
Create driver availability.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "vehicleId": "vehicle_789",
  "date": "2026-02-03",
  "windowStartAt": "2026-02-03T07:00:00Z",
  "windowEndAt": "2026-02-03T07:45:00Z",
  "seatCapacityAtTime": 3,
  "preferenceRouteId": "route_101"
}
```

**State Machine:** Creates Availability in `ACTIVE` status

**Response (201):**
```json
{
  "requestId": "req_010",
  "data": {
    "availability": {
      "id": "avail_456",
      "householdMemberId": "member_123",
      "vehicleId": "vehicle_789",
      "date": "2026-02-03",
      "windowStartAt": "2026-02-03T07:00:00Z",
      "windowEndAt": "2026-02-03T07:45:00Z",
      "seatCapacityAtTime": 3,
      "seatsAvailable": 3,
      "status": "ACTIVE"
    }
  }
}
```

**Constraints:**
- No overlapping `ACTIVE` windows per driver per date
- Returns 409 Conflict if constraint violated

### PATCH /availability/{availabilityId}/clear
Clear availability (driver cancels).

**Headers:**
```
Idempotency-Key: {uuid}
```

**State Machine:** `ACTIVE` → `CLEARED`

**Response (200):**
```json
{
  "requestId": "req_011",
  "data": {
    "availability": {
      "id": "avail_456",
      "status": "CLEARED",
      "updatedAt": "2026-02-02T10:20:00Z"
    }
  }
}
```

### GET /availability
Query availability with filters.

**Query Parameters:**
- `date` (required, YYYY-MM-DD)
- `status` (optional)
- `routeId` (optional)

**Response (200):**
```json
{
  "requestId": "req_012",
  "data": {
    "availabilities": [
      {
        "id": "avail_456",
        "driver": {
          "memberId": "member_789",
          "displayName": "John Smith"
        },
        "vehicle": {
          "id": "vehicle_999",
          "label": "Toyota Sienna",
          "seatCapacity": 6
        },
        "seatsAvailable": 3,
        "windowStartAt": "2026-02-03T07:00:00Z",
        "windowEndAt": "2026-02-03T07:45:00Z",
        "status": "ACTIVE"
      }
    ]
  }
}
```

---

## 5. Offer/Request (Matching)

### POST /offer-requests
Create offer or request (unified endpoint).

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request (Parent requests from Driver):**
```json
{
  "type": "REQUEST",
  "needId": "need_123",
  "availabilityId": "avail_456",
  "message": "Can you give Emma a ride tomorrow morning?"
}
```

**Request (Driver offers to Parent):**
```json
{
  "type": "OFFER",
  "needId": "need_123",
  "availabilityId": "avail_456",
  "message": "I'm driving that route tomorrow, happy to help!"
}
```

**State Machine:** Creates OfferRequest in `SENT` status

**Response (201):**
```json
{
  "requestId": "req_013",
  "data": {
    "offerRequest": {
      "id": "offer_789",
      "type": "REQUEST",
      "needId": "need_123",
      "availabilityId": "avail_456",
      "fromMemberId": "member_123",
      "toMemberId": "member_789",
      "status": "SENT",
      "createdAt": "2026-02-02T10:25:00Z"
    }
  }
}
```

**Validation:**
- Need must be `OPEN`
- Availability must be `ACTIVE`
- Time windows must overlap
- Seats available > 0
- Driver not on child's blocklist
- Returns 400 Bad Request if validation fails

### POST /offer-requests/{offerRequestId}/respond
Accept or decline an offer/request.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "action": "ACCEPT"  // or "DECLINE"
}
```

**State Machine (ACCEPT):** 
- OfferRequest: `SENT` → `ACCEPTED`
- Need: `OPEN` → `ASSIGNED`
- Creates RideSession atomically
- Rejects other pending offers for same Need
- Issues notification

**Response (200):**
```json
{
  "requestId": "req_014",
  "data": {
    "offerRequest": {
      "id": "offer_789",
      "status": "ACCEPTED"
    },
    "rideSession": {
      "id": "session_999",
      "date": "2026-02-03",
      "needId": "need_123",
      "driverMemberId": "member_789",
      "vehicleId": "vehicle_999",
      "sessionStatus": "ASSIGNED",
      "assignedAt": "2026-02-02T10:30:00Z"
    }
  }
}
```

**Constraint:** Only one `ACCEPTED` OfferRequest per Need (atomic transaction)

---

## 6. Ride Execution

### GET /ride-sessions/{rideSessionId}
Get ride session details.

**Response (200):**
```json
{
  "requestId": "req_015",
  "data": {
    "rideSession": {
      "id": "session_999",
      "date": "2026-02-03",
      "sessionStatus": "IN_PROGRESS",
      "driver": {
        "memberId": "member_789",
        "displayName": "John Smith"
      },
      "vehicle": {
        "id": "vehicle_999",
        "label": "Toyota Sienna"
      },
      "children": [
        {
          "id": "child_456",
          "firstName": "Emma",
          "lastInitial": "D"
        }
      ],
      "statusEvents": [
        {
          "status": "ARRIVED",
          "eventAt": "2026-02-03T07:05:00Z"
        },
        {
          "status": "PICKED_UP",
          "eventAt": "2026-02-03T07:08:00Z"
        }
      ],
      "assignedAt": "2026-02-02T10:30:00Z",
      "startedAt": "2026-02-03T07:05:00Z"
    }
  }
}
```

### POST /ride-sessions/{rideSessionId}/status
Update ride status (driver actions).

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "status": "PICKED_UP",
  "geoLat": 37.7749,
  "geoLng": -122.4194,
  "metadata": {
    "notes": "All children picked up successfully"
  }
}
```

**State Machine (Status Events):**
- `ARRIVED` → `PICKED_UP` → `DROPPED_OFF`
- `DELAYED` can occur anytime (doesn't advance state)
- No regression allowed

**Response (200):**
```json
{
  "requestId": "req_016",
  "data": {
    "rideSession": {
      "id": "session_999",
      "sessionStatus": "IN_PROGRESS"
    },
    "statusEvent": {
      "id": "event_555",
      "rideSessionId": "session_999",
      "status": "PICKED_UP",
      "actorMemberId": "member_789",
      "eventAt": "2026-02-03T07:08:00Z",
      "geoLat": 37.7749,
      "geoLng": -122.4194
    }
  }
}
```

**Special: DROPPED_OFF triggers Care Credit issuance**

When status `DROPPED_OFF` is recorded:
1. RideSession transitions to `COMPLETED`
2. `CareCreditEvent` is created (idempotent)
3. `CareCreditSummary` is updated (async)
4. Notification sent to driver

---

## 7. Care Credits

### GET /me/care-credits
Get current user's Care Credits summary.

**Response (200):**
```json
{
  "requestId": "req_017",
  "data": {
    "summary": {
      "householdMemberId": "member_123",
      "totalEarned": 42,
      "byEventType": {
        "RIDE_COMPLETED": 42
      },
      "lastCalculatedAt": "2026-02-02T10:00:00Z"
    },
    "recentEvents": [
      {
        "id": "credit_789",
        "eventType": "RIDE_COMPLETED",
        "units": 1,
        "contextType": "RIDE_SESSION",
        "contextId": "session_888",
        "eventAt": "2026-02-01T08:15:00Z"
      }
    ]
  }
}
```

### GET /members/{householdMemberId}/care-credits
View another member's Care Credits (within shared household/community).

**Response (200):**
```json
{
  "requestId": "req_018",
  "data": {
    "summary": {
      "householdMemberId": "member_789",
      "totalEarned": 28,
      "byEventType": {
        "RIDE_COMPLETED": 28
      }
    },
    "reliability": {
      "completionRate": 98.5,
      "onTimeRate": 95.0
    }
  }
}
```

### GET /care-credits/bilateral
Get bilateral balance between current user and another member (Phase 2).

**Query Parameters:**
- `otherMemberId` (required)

**Response (200):**
```json
{
  "requestId": "req_019",
  "data": {
    "balance": {
      "memberAId": "member_123",
      "memberBId": "member_789",
      "aHelpedB": 5,
      "bHelpedA": 2,
      "netUnits": 3,
      "message": "John has helped you 3 more times"
    }
  }
}
```

---

## 8. Safety & Trust

### POST /children/{childId}/blocklist
Add driver to child's blocklist.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "blockedHouseholdMemberId": "member_999",
  "reason": "Personal preference"
}
```

**Response (201):**
```json
{
  "requestId": "req_020",
  "data": {
    "blocklist": {
      "id": "block_123",
      "childId": "child_456",
      "blockedHouseholdMemberId": "member_999",
      "status": "active",
      "createdAt": "2026-02-02T10:35:00Z"
    }
  }
}
```

**Effect:** Blocked driver excluded from:
- Matching results
- Offer/Request creation (validation fails)

### DELETE /children/{childId}/blocklist/{blocklistId}
Remove driver from blocklist.

**Response (200):**
```json
{
  "requestId": "req_021",
  "data": {
    "blocklist": {
      "id": "block_123",
      "status": "removed",
      "updatedAt": "2026-02-02T10:40:00Z"
    }
  }
}
```

---

## 9. Notifications

### GET /notifications
Get user's notifications.

**Query Parameters:**
- `limit` (default: 20)
- `unreadOnly` (default: false)
- `category` (optional)

**Response (200):**
```json
{
  "requestId": "req_022",
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "category": "ACCEPTANCE",
        "title": "Ride Confirmed",
        "body": "John Smith will pick up Emma at 7:15 AM",
        "deepLink": "kidcoord://ride-session/session_999",
        "status": "SENT",
        "createdAt": "2026-02-02T10:30:00Z",
        "readAt": null
      }
    ],
    "unreadCount": 3
  }
}
```

### POST /notifications/{notificationId}/read
Mark notification as read.

**Response (200):**
```json
{
  "requestId": "req_023",
  "data": {
    "notification": {
      "id": "notif_123",
      "status": "READ",
      "readAt": "2026-02-02T10:45:00Z"
    }
  }
}
```

---

## 10. Admin

### POST /admin/override
Admin action on a ride session.

**Headers:**
```
Idempotency-Key: {uuid}
```

**Request:**
```json
{
  "rideSessionId": "session_999",
  "action": "CANCEL",
  "reason": "Safety concern reported"
}
```

**Response (200):**
```json
{
  "requestId": "req_024",
  "data": {
    "rideSession": {
      "id": "session_999",
      "sessionStatus": "CANCELLED",
      "cancelledAt": "2026-02-02T11:00:00Z"
    },
    "auditEvent": {
      "id": "audit_456",
      "eventType": "ADMIN_OVERRIDE",
      "actorUserId": "admin_001"
    }
  }
}
```

### GET /admin/audit-log
Query audit events.

**Query Parameters:**
- `entityType` (optional)
- `entityId` (optional)
- `actorUserId` (optional)
- `startDate` (optional, ISO8601)
- `endDate` (optional, ISO8601)
- `limit` (default: 50)
- `offset` (default: 0)

**Response (200):**
```json
{
  "requestId": "req_025",
  "data": {
    "events": [
      {
        "id": "audit_456",
        "eventType": "RIDE_SESSION_COMPLETED",
        "actorMemberId": "member_789",
        "entityType": "RIDE_SESSION",
        "entityId": "session_999",
        "eventAt": "2026-02-03T08:15:00Z",
        "metadata": {
          "completedOnTime": true
        }
      }
    ],
    "total": 1523,
    "hasMore": true
  }
}
```

---

## 11. Realtime Updates (WebSocket)

### WS /realtime
WebSocket connection for live updates.

**Connection:**
```javascript
const ws = new WebSocket('wss://api.kidcoord.com/api/v2/realtime?token={token}');
```

**Event Envelope:**
```json
{
  "eventType": "RIDE_STATUS_UPDATED",
  "entityType": "RIDE_SESSION",
  "entityId": "session_999",
  "payload": {
    "sessionStatus": "IN_PROGRESS",
    "lastEvent": {
      "status": "PICKED_UP",
      "eventAt": "2026-02-03T07:08:00Z"
    }
  },
  "occurredAt": "2026-02-03T07:08:00Z"
}
```

**Event Types:**
- `NEED_CREATED`
- `NEED_ASSIGNED`
- `AVAILABILITY_CREATED`
- `OFFER_REQUEST_SENT`
- `OFFER_REQUEST_ACCEPTED`
- `RIDE_STATUS_UPDATED`
- `CARE_CREDIT_ISSUED`
- `NOTIFICATION_CREATED`

---

## Error Responses

All errors follow this format:

```json
{
  "requestId": "req_xxx",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "windowStartAt",
      "issue": "Start time must be in the future"
    }
  },
  "timestamp": "2026-02-02T10:00:00Z"
}
```

### Error Codes
- `UNAUTHORIZED` (401): Missing or invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Constraint violation (e.g., duplicate Need)
- `VALIDATION_ERROR` (400): Invalid request data
- `IDEMPOTENCY_CONFLICT` (409): Same key, different request
- `STATE_TRANSITION_ERROR` (400): Invalid status transition
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

---

## Rate Limiting

- General endpoints: 100 requests/minute per user
- Dashboard endpoints: 20 requests/minute per user
- Auth endpoints: 5 requests/minute per IP
- Websocket: 1 connection per session

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643788800
```

---

## Idempotency Behavior

When the same `Idempotency-Key` is used:
- Within expiration window (24 hours): Returns cached response (200 OK)
- Different request body: Returns 409 Conflict
- After expiration: Treated as new request

---

## State Machine Summary

### Need
```
OPEN → ASSIGNED → (terminal)
OPEN → CANCELLED → (terminal)
OPEN → EXPIRED → (terminal)
```

### Availability
```
ACTIVE → CLEARED → (terminal)
ACTIVE → EXPIRED → (terminal)
```

### OfferRequest
```
SENT → ACCEPTED → (terminal)
SENT → DECLINED → (terminal)
SENT → EXPIRED → (terminal)
SENT → CANCELLED → (terminal)
```

### RideSession
```
ASSIGNED → IN_PROGRESS → COMPLETED → (terminal)
ASSIGNED → CANCELLED → (terminal)
IN_PROGRESS → CANCELLED → (terminal)
```

### RideStatusEvent (append-only, no transitions)
```
ARRIVED → PICKED_UP → DROPPED_OFF
DELAYED (can occur anytime)
```

---

**Last Updated:** February 2, 2026  
**Version:** 2.0 (Architecture-Aligned)
