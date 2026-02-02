# KidCoord Backend API

**Version:** 2.0  
**Architecture:** Event-driven, idempotent, audit-first

Node.js + TypeScript + Express + PostgreSQL backend for the KidCoord coordination platform.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Set up database**
```bash
# Create database
createdb kidcoord

# Run schema
psql kidcoord < schema.sql
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server**
```bash
npm run dev
```

Server will start at `http://localhost:3000`

---

## Architecture Overview

### Core Principles
- **Event-Driven**: Every action generates immutable events
- **Idempotent**: Safe retries with `Idempotency-Key` header
- **State Machines**: Explicit status transitions with validation
- **Audit-First**: Complete traceability of all actions

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ with connection pooling
- **Logging**: Winston structured logging
- **Security**: Helmet, CORS, rate limiting

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main Express app
│   ├── routes/               # API route handlers
│   │   ├── needs.ts          # Needs endpoints (complete example)
│   │   └── availabilities.ts # Availabilities endpoints (TODO)
│   ├── services/             # Business logic services
│   ├── middleware/           # Express middleware
│   │   └── idempotency.ts    # Idempotency key handling
│   ├── utils/                # Utility functions
│   │   ├── database.ts       # DB connection & helpers
│   │   ├── logger.ts         # Winston logger setup
│   │   └── stateMachine.ts   # State transition validation
│   └── types/                # TypeScript type definitions
├── schema.sql                # PostgreSQL schema
├── package.json
├── tsconfig.json
└── .env.example              # Environment variable template
```

---

## API Endpoints

### Health Check
```
GET /health
```

### Needs
```
POST   /api/v2/needs                 # Create need
PATCH  /api/v2/needs/:needId/cancel  # Cancel need
GET    /api/v2/needs                 # Query needs
```

### Availabilities (TODO)
```
POST   /api/v2/availability                     # Create availability
PATCH  /api/v2/availability/:availabilityId/clear # Clear availability
GET    /api/v2/availability                     # Query availabilities
```

### Other Endpoints (To Implement)
- Offer/Requests
- Ride Sessions
- Ride Status Events
- Care Credits
- Blocklists
- Notifications

See `../../API_V2.md` for complete API specification.

---

## State Machines

All entities follow explicit state machines enforced at the service layer:

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

Invalid transitions return `400 Bad Request` with state machine error.

---

## Idempotency

All write operations support idempotency via the `Idempotency-Key` header:

```bash
curl -X POST http://localhost:3000/api/v2/needs \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_123",
    "needType": "DROP_OFF",
    "date": "2026-02-03",
    "windowStartAt": "2026-02-03T07:00:00Z",
    "windowEndAt": "2026-02-03T07:30:00Z"
  }'
```

**Behavior:**
- First request: Creates resource, returns `201 Created`
- Retry with same key + body: Returns cached `200 OK`
- Same key + different body: Returns `409 Conflict`
- After 24 hours: Key expires, treated as new request

---

## Database Schema

### Key Tables

**Identity & Access**
- `users` - User accounts
- `sessions` - Active sessions
- `households` - Family units
- `household_members` - User membership with roles

**Household Setup**
- `children` - Child records (PII minimized)
- `vehicles` - Household vehicles
- `child_school_profiles` - School/route assignments

**Registry**
- `schools`, `routes`, `stops` - Admin-managed metadata

**Coordination**
- `needs` - Child coordination needs
- `availabilities` - Driver availability
- `offer_requests` - Connects needs with availability
- `ride_sessions` - Execution tracking
- `ride_status_events` - Append-only ride timeline

**Care Credits**
- `care_credit_events` - Immutable contribution records
- `care_credit_summaries` - Cached aggregates

**Safety & Trust**
- `blocklists` - Child-level driver exclusions
- `audit_events` - Immutable action log
- `idempotency_keys` - Request deduplication

---

## Development Workflow

### Running Locally

```bash
# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Apply schema
psql kidcoord < schema.sql

# Reset database (DEV ONLY)
dropdb kidcoord && createdb kidcoord
psql kidcoord < schema.sql
```

### Testing API

```bash
# Health check
curl http://localhost:3000/health

# Create need (requires auth token)
curl -X POST http://localhost:3000/api/v2/needs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "child_123",
    "needType": "DROP_OFF",
    "date": "2026-02-03",
    "windowStartAt": "2026-02-03T07:00:00Z",
    "windowEndAt": "2026-02-03T07:30:00Z"
  }'
```

---

## Error Handling

All errors follow consistent format:

```json
{
  "requestId": "req_abc123",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "2026-02-02T10:00:00Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR` (400): Invalid request data
- `UNAUTHORIZED` (401): Missing/invalid auth token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONSTRAINT_VIOLATION` (409): Database constraint violated
- `STATE_TRANSITION_ERROR` (400): Invalid state machine transition
- `IDEMPOTENCY_CONFLICT` (409): Same key, different request
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

---

## Logging

Structured JSON logs with Winston:

```json
{
  "timestamp": "2026-02-02 10:00:00",
  "level": "info",
  "message": "Need created",
  "service": "kidcoord-api",
  "needId": "need_123",
  "userId": "user_456",
  "requestId": "req_789"
}
```

**Log Levels:**
- `error`: Errors requiring attention
- `warn`: Warning conditions
- `info`: Informational messages (default)
- `debug`: Detailed debugging information

Set via `LOG_LEVEL` environment variable.

---

## Security

### Implemented
- Helmet security headers
- CORS configuration
- Rate limiting (100 req/min per IP)
- Request ID tracking
- Structured error responses (no stack traces in production)

### TODO
- JWT authentication middleware
- Role-based access control (RBAC)
- Input sanitization
- SQL injection prevention (using parameterized queries)
- API key management

---

## Testing

### Unit Tests (TODO)
```bash
npm test
```

### Integration Tests (TODO)
Test complete workflows:
- Create need → offer → accept → ride session → completion → Care Credit

### Load Testing (TODO)
Use k6 or Artillery for load testing:
```bash
k6 run loadtest.js
```

---

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set strong `JWT_SECRET`
- [ ] Configure OTP provider credentials
- [ ] Set up push notification credentials
- [ ] Configure logging to external service
- [ ] Set up database backups
- [ ] Configure monitoring (DataDog, New Relic)
- [ ] Set up error tracking (Sentry)
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting per use case
- [ ] Set up CDN for static assets

### Environment Variables
See `.env.example` for all configuration options.

---

## Next Steps

### Immediate
1. [ ] Implement authentication endpoints (`/auth/otp/*`)
2. [ ] Complete availabilities endpoints
3. [ ] Implement offer-requests endpoints
4. [ ] Add ride-sessions endpoints
5. [ ] Add Care Credits endpoints

### Short-term
1. [ ] Add WebSocket support for realtime updates
2. [ ] Implement outbox pattern worker
3. [ ] Add comprehensive test suite
4. [ ] Set up CI/CD pipeline
5. [ ] Add API documentation (Swagger/OpenAPI)

### Medium-term
1. [ ] Add Redis caching layer
2. [ ] Implement push notifications
3. [ ] Add admin console endpoints
4. [ ] Set up monitoring and alerts
5. [ ] Performance optimization

---

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql kidcoord -c "SELECT NOW();"

# Check if server is running
pg_isready -h localhost -p 5432
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID
```

### TypeScript Errors
```bash
# Clean build
rm -rf dist
npm run build
```

---

## Resources

- **API Specification**: See `../../API_V2.md`
- **Architecture**: See `../../ARCHITECTURE.md`
- **State Machine Tests**: See `../../STATE_MACHINE_TESTS.md`
- **Database Schema**: See `schema.sql`

---

## Contributing

1. Follow TypeScript strict mode
2. Use structured logging (Winston)
3. Add state machine validation for all status changes
4. Include idempotency support for write operations
5. Write comprehensive error messages
6. Add audit events for all meaningful actions
7. Update tests for new features

---

## License

Proprietary - All rights reserved

---

**Built with care for parents, by parents** ❤️
