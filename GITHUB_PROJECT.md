# KidCoord - GitHub Project Integration

**Project Board:** https://github.com/users/kaushikkuberanathan/projects/3  
**Repository:** https://github.com/kaushikkuberanathan/KidCoord

This document explains how the codebase integrates with the GitHub project board.

---

## 🎯 Project Board Structure

Your GitHub project should have these columns:
- **📋 Backlog** - Future tasks
- **🔜 Todo** - Ready to work on
- **🏗️ In Progress** - Currently being worked on
- **👀 In Review** - PR submitted, awaiting review
- **✅ Done** - Completed tasks

---

## 📝 Creating Issues from Implementation Progress

Based on `docs/IMPLEMENTATION_PROGRESS.md`, here are the recommended issues to create:

### Priority 1: Core Coordination API (2-3 weeks)

#### Issue #1: Implement Availability Endpoints
```markdown
**Title:** [Backend] Implement Availability API Endpoints
**Labels:** backend, priority-1, enhancement
**Milestone:** Core Coordination
**Assignee:** @kaushikkuberanathan

**Description:**
Implement availability management endpoints following the pattern in `backend/src/routes/needs.ts`

**Endpoints to implement:**
- POST /api/v2/availability - Create driver availability
- PATCH /api/v2/availability/:id/clear - Clear availability
- GET /api/v2/availability - Query availabilities

**Acceptance Criteria:**
- [ ] All endpoints follow idempotency pattern
- [ ] State machine validation implemented (ACTIVE → CLEARED/EXPIRED)
- [ ] Database constraint prevents overlapping ACTIVE windows
- [ ] Audit events logged
- [ ] Tests added to STATE_MACHINE_TESTS.md
- [ ] API_V2.md documentation matches implementation

**Reference:**
- Example: `backend/src/routes/needs.ts`
- State machine: `backend/src/utils/stateMachine.ts`
- API spec: `docs/API_V2.md` (lines 200-250)
```

#### Issue #2: Implement Offer/Request Endpoints
```markdown
**Title:** [Backend] Implement Offer/Request API Endpoints
**Labels:** backend, priority-1, enhancement
**Milestone:** Core Coordination

**Description:**
Implement the unified offer/request endpoint that connects Needs with Availabilities

**Endpoints:**
- POST /api/v2/offer-requests
- POST /api/v2/offer-requests/:id/respond

**Acceptance Criteria:**
- [ ] Unified endpoint handles both OFFER and REQUEST types
- [ ] Accept response creates RideSession atomically
- [ ] Other pending offers auto-declined on accept
- [ ] Seat count decremented on availability
- [ ] State transitions validated
- [ ] Transaction-based (all-or-nothing)

**Reference:**
- API spec: `docs/API_V2.md` (Offer/Request section)
- State machine: `docs/STATE_MACHINE_TESTS.md` (TC-O-*)
```

#### Issue #3: Implement Ride Session Endpoints
```markdown
**Title:** [Backend] Implement Ride Session API Endpoints
**Labels:** backend, priority-1, enhancement
**Milestone:** Core Coordination

**Endpoints:**
- GET /api/v2/ride-sessions/:id
- POST /api/v2/ride-sessions/:id/status
- GET /api/v2/ride-sessions

**Acceptance Criteria:**
- [ ] Status updates validate event progression (ARRIVED → PICKED_UP → DROPPED_OFF)
- [ ] DROPPED_OFF triggers Care Credit issuance
- [ ] Append-only status events
- [ ] No regression in timeline
- [ ] RideSession status derived from events
```

### Priority 2: Care Credits & Safety (1-2 weeks)

#### Issue #4: Implement Care Credits System
```markdown
**Title:** [Backend] Implement Care Credits Endpoints and Worker
**Labels:** backend, priority-2, enhancement
**Milestone:** Care Credits

**Components:**
1. API Endpoints:
   - GET /me/care-credits
   - GET /members/:id/care-credits
   
2. Background Worker:
   - Process OutboxEvents
   - Issue credits on ride completion
   - Update summaries

**Acceptance Criteria:**
- [ ] Idempotent credit issuance
- [ ] No duplicate credits (constraint enforced)
- [ ] Summary calculation correct
- [ ] Outbox pattern implemented
- [ ] Worker processes pending events
```

#### Issue #5: Implement Blocklist Endpoints
```markdown
**Title:** [Backend] Implement Blocklist Safety Feature
**Labels:** backend, priority-2, safety, enhancement

**Endpoints:**
- POST /children/:id/blocklist
- DELETE /children/:id/blocklist/:blockId
- GET /children/:id/blocklist

**Acceptance Criteria:**
- [ ] Blocklist enforced in matching
- [ ] Validation prevents offers to blocked drivers
- [ ] Child-level privacy maintained
- [ ] Audit events logged
```

### Priority 3: Authentication (1-2 weeks)

#### Issue #6: Implement OTP Authentication
```markdown
**Title:** [Backend] Implement OTP-based Authentication
**Labels:** backend, priority-3, authentication

**Endpoints:**
- POST /auth/otp/request
- POST /auth/otp/verify
- GET /auth/session
- POST /auth/logout

**Acceptance Criteria:**
- [ ] OTP provider integrated (Twilio/Firebase)
- [ ] JWT tokens issued on verify
- [ ] Session bootstrap returns user + households
- [ ] Auth middleware protects endpoints
- [ ] Token refresh mechanism
```

### Frontend Migration

#### Issue #7: Migrate Frontend to v2 Architecture
```markdown
**Title:** [Frontend] Migrate App to v2 Architecture
**Labels:** frontend, refactor, priority-medium
**Milestone:** Frontend v2

**Tasks:**
- [ ] Update stores for HouseholdMember model
- [ ] Create idempotency key generator
- [ ] Update ChildCard for Need + RideSession
- [ ] Refactor MorningDashboardScreen
- [ ] Create coordinationService
- [ ] Add state machine validation UI
- [ ] Update ProfileScreen for CareCreditSummary

**Reference:**
- Guide: `docs/MIGRATION_GUIDE.md`
- Estimate: 20-30 hours
```

---

## 🏷️ Labels to Create

Create these labels in your repository:

**Type:**
- `backend` - Backend API changes
- `frontend` - Mobile app changes on the locked native React Native 0.73 client (`docs/CLIENT_SHELL.md`)
- `database` - Schema changes
- `docs` - Documentation only

**Priority:**
- `priority-1` - Critical MVP functionality
- `priority-2` - Important but not blocking
- `priority-3` - Nice to have

**Category:**
- `enhancement` - New feature
- `bug` - Bug fix
- `refactor` - Code improvement
- `test` - Testing
- `security` - Security-related
- `safety` - Child safety features

**Status:**
- `blocked` - Blocked by another issue
- `needs-review` - Needs design/technical review
- `good-first-issue` - Good for newcomers

---

## 🎯 Milestones to Create

1. **Core Coordination** (Target: 3 weeks)
   - Issues #1, #2, #3
   
2. **Care Credits** (Target: 2 weeks)
   - Issues #4, #5
   
3. **Authentication** (Target: 2 weeks)
   - Issue #6
   
4. **Frontend v2** (Target: 4 weeks)
   - Issue #7

---

## 🔄 Workflow Automation

### Linking Issues to PRs

When creating a PR:
```markdown
Closes #1
```

This automatically:
- Links PR to issue
- Moves issue to "In Review" (if you set up automation)
- Closes issue when PR is merged

### Branch Naming Convention

```
feature/availability-api      # For issue #1
fix/idempotency-bug          # For bugs
refactor/state-machine       # For refactoring
docs/api-updates             # For documentation
```

### Commit Messages

```bash
git commit -m "feat(backend): implement availability endpoints (#1)"
git commit -m "fix(frontend): resolve state machine validation (#12)"
git commit -m "docs: update API specification"
```

---

## 📊 Project Board Automation

Set up GitHub Actions automation (already in `.github/workflows/ci.yml`):

1. **When PR opened:** Move issue to "In Review"
2. **When PR merged:** Move issue to "Done"
3. **When tests fail:** Add comment to PR

---

## 📈 Progress Tracking

Track progress using:

1. **Milestones:** See % complete
2. **Project Board:** Visual kanban
3. **IMPLEMENTATION_PROGRESS.md:** Detailed technical roadmap
4. **CHECKLIST.md:** Task-level tracking

Update `CHECKLIST.md` as you complete items:
```markdown
- [x] Needs API endpoint
- [ ] Availability API endpoint
```

---

## 🚀 Getting Started

1. **Create issues** from the templates above
2. **Add to project board** (Backlog column)
3. **Prioritize** by moving to Todo
4. **Create feature branch:**
   ```bash
   git checkout -b feature/availability-api
   ```
5. **Implement** following the example in `backend/src/routes/needs.ts`
6. **Test** and commit
7. **Open PR** with template
8. **Move to "In Review"** on project board
9. **Merge** when approved
10. **Issue auto-closes** and moves to "Done"

---

## 📝 Daily Workflow Example

### Morning
1. Check project board
2. Move issue from "Todo" to "In Progress"
3. Create feature branch
4. Start coding

### During Day
5. Commit frequently with good messages
6. Update CHECKLIST.md
7. Run tests locally

### End of Day
8. Push branch
9. Open PR (or draft PR)
10. Update issue with progress

### Review
11. Reviewer checks code
12. Address feedback
13. Tests pass
14. Merge to main
15. Issue auto-closes

---

## 🎯 Success Metrics

Track on project board:

- **Velocity:** Issues completed per week
- **WIP Limit:** Max 3 items in "In Progress"
- **Cycle Time:** Days from Todo → Done
- **Code Coverage:** Aim for >80%

---

**Your project board is the single source of truth for what's being worked on!**

Use `docs/IMPLEMENTATION_PROGRESS.md` for the technical roadmap, and GitHub Issues for task tracking.
