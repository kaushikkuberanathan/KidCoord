# Migration Guide: v1 → v2 Architecture

**Purpose:** Guide for updating existing KidCoord code to match the refined architecture  
**Version:** 2.0  
**Date:** February 2, 2026

This guide walks through updating the MVP codebase to align with the event-driven, state-machine-based architecture.

---

## Overview of Changes

### Key Architectural Shifts

| v1 Concept | v2 Concept | Why Changed |
|-----------|-----------|-------------|
| User with single household | HouseholdMember with roles | Users can belong to multiple households |
| RideRequest + Ride | Need + OfferRequest + RideSession | Clearer separation of coordination stages |
| RideStatus enum | State machines + RideStatusEvent | Explicit valid transitions, append-only timeline |
| Care Credits as simple counter | CareCreditEvent + Summary | Event-driven, idempotent, auditable |
| Phone/email stored plain | Hashed with optional encrypted raw | PII minimization |
| Child with full name | Child with first name + last initial | Privacy |

---

## Step 1: Update Domain Types

### Before (v1)
```typescript
// src/types/domain.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  careCredits: number;
}

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  householdId: string;
  schoolId: string;
  blockedDriverIds: string[];
}
```

### After (v2)
```typescript
// Already updated in domain.ts!
export interface User {
  id: string;
  phoneHash?: string;
  emailHash?: string;
  displayName: string;
  status: 'active' | 'disabled';
  isAdmin: boolean;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  roles: HouseholdMemberRole[];
  status: 'active' | 'disabled';
}

export interface Child {
  id: string;
  householdId: string;
  firstName: string;
  lastInitial?: string; // Privacy
  status: 'active' | 'disabled';
}
```

**Action Items:**
- [ ] Update all component props expecting v1 User → v2 User
- [ ] Update all references to `user.firstName/lastName` → `user.displayName`
- [ ] Update Child components to use `lastInitial` instead of `lastName`

---

## Step 2: Update Store Structure

### Before (v1)
```typescript
// src/store/appStore.ts
interface AppStore {
  user: User | null;
  children: Child[];
  // ...
}
```

### After (v2)
```typescript
interface AppStore {
  user: User | null;
  householdMembers: HouseholdMember[]; // NEW
  households: Household[]; // NEW
  children: Child[];
  currentHouseholdId: string | null; // NEW
  // ...
}
```

**Migration Steps:**

1. **Add new state slices**
   ```typescript
   // src/store/appStore.ts
   
   interface HouseholdState {
     households: Household[];
     householdMembers: HouseholdMember[];
     currentHouseholdId: string | null;
     
     setHouseholds: (households: Household[]) => void;
     setHouseholdMembers: (members: HouseholdMember[]) => void;
     setCurrentHousehold: (householdId: string) => void;
     getCurrentMember: () => HouseholdMember | null;
   }
   ```

2. **Add helper methods**
   ```typescript
   getCurrentMember: () => {
     const { user, householdMembers, currentHouseholdId } = get();
     if (!user || !currentHouseholdId) return null;
     
     return householdMembers.find(m => 
       m.userId === user.id && 
       m.householdId === currentHouseholdId
     ) || null;
   }
   ```

**Action Items:**
- [ ] Add household state to appStore
- [ ] Update hydrate() to load household data
- [ ] Add getCurrentMember() helper
- [ ] Update components to use getCurrentMember() instead of just user

---

## Step 3: Replace RideRequest/Ride with Need/RideSession

### Before (v1)
```typescript
// src/store/dashboardStore.ts
interface DashboardState {
  children: Array<Child & {
    rideRequest?: RideRequest;
    ride?: Ride;
  }>;
}
```

### After (v2)
```typescript
interface DashboardState {
  needs: Need[]; // All needs for current household
  availabilities: Availability[]; // Driver availabilities
  offerRequests: OfferRequest[]; // Inbox
  rideSessions: RideSession[]; // Active rides
  
  // Derived views
  getChildNeeds: (childId: string) => Need[];
  getActiveRideSessions: () => RideSession[];
}
```

**Migration Steps:**

1. **Create new dashboard store structure**
   ```typescript
   // src/store/dashboardStore.ts
   export const useDashboardStore = create<DashboardState>((set, get) => ({
     needs: [],
     availabilities: [],
     offerRequests: [],
     rideSessions: [],
     
     setNeeds: (needs) => set({ needs }),
     setAvailabilities: (availabilities) => set({ availabilities }),
     setOfferRequests: (offerRequests) => set({ offerRequests }),
     setRideSessions: (rideSessions) => set({ rideSessions }),
     
     getChildNeeds: (childId) => {
       return get().needs.filter(n => n.childId === childId);
     },
     
     getActiveRideSessions: () => {
       return get().rideSessions.filter(rs => 
         rs.sessionStatus === 'ASSIGNED' || 
         rs.sessionStatus === 'IN_PROGRESS'
       );
     },
   }));
   ```

**Action Items:**
- [ ] Update dashboardStore with new entities
- [ ] Add derived data selectors
- [ ] Update MorningDashboardScreen to use new store shape

---

## Step 4: Update API Service Layer

### Before (v1)
```typescript
// src/services/dashboardService.ts
export async function createRideRequest(
  childId: string,
  date: string
): Promise<RideRequest> {
  // ...
}
```

### After (v2)
```typescript
export async function createNeed(
  request: CreateNeedRequest,
  idempotencyKey: string // NEW
): Promise<Need> {
  const response = await apiClient.post<Need>(
    '/needs',
    request,
    {
      headers: {
        'Idempotency-Key': idempotencyKey, // NEW
      },
    }
  );
  // ...
}
```

**Migration Steps:**

1. **Add idempotency key generation**
   ```typescript
   // src/utils/idempotency.ts
   import { v4 as uuidv4 } from 'uuid';
   
   export function generateIdempotencyKey(
     action: string,
     entityId: string
   ): string {
     return `${action}-${entityId}-${uuidv4()}`;
   }
   ```

2. **Update API client to support idempotency headers**
   ```typescript
   // src/services/apiClient.ts
   async post<T>(
     endpoint: string,
     body?: any,
     options?: {
       headers?: Record<string, string>;
       idempotencyKey?: string;
     }
   ): Promise<ApiResponse<T>> {
     const headers: HeadersInit = {
       'Content-Type': 'application/json',
       ...options?.headers,
     };
     
     if (options?.idempotencyKey) {
       headers['Idempotency-Key'] = options.idempotencyKey;
     }
     
     // ... rest of implementation
   }
   ```

3. **Create new service methods for v2 endpoints**
   ```typescript
   // src/services/coordinationService.ts (NEW FILE)
   
   export async function createNeed(
     request: CreateNeedRequest
   ): Promise<{ data: Need | null; error: string | null }> {
     const idempotencyKey = generateIdempotencyKey(
       'create-need',
       request.childId
     );
     
     const response = await apiClient.post<Need>(
       '/needs',
       request,
       { idempotencyKey }
     );
     
     if (isApiSuccess(response)) {
       return { data: response.data, error: null };
     }
     
     return { data: null, error: handleApiError(response) };
   }
   
   export async function createAvailability(
     request: CreateAvailabilityRequest
   ): Promise<{ data: Availability | null; error: string | null }> {
     const idempotencyKey = generateIdempotencyKey(
       'create-availability',
       request.vehicleId
     );
     
     const response = await apiClient.post<Availability>(
       '/availability',
       request,
       { idempotencyKey }
     );
     
     if (isApiSuccess(response)) {
       return { data: response.data, error: null };
     }
     
     return { data: null, error: handleApiError(response) };
   }
   
   export async function sendOfferRequest(
     request: SendOfferRequestRequest
   ): Promise<{ data: OfferRequest | null; error: string | null }> {
     const idempotencyKey = generateIdempotencyKey(
       'send-offer',
       request.needId
     );
     
     const response = await apiClient.post<OfferRequest>(
       '/offer-requests',
       request,
       { idempotencyKey }
     );
     
     if (isApiSuccess(response)) {
       return { data: response.data, error: null };
     }
     
     return { data: null, error: handleApiError(response) };
   }
   
   export async function respondToOfferRequest(
     offerRequestId: string,
     action: 'ACCEPT' | 'DECLINE'
   ): Promise<{ 
     data: { offerRequest: OfferRequest; rideSession?: RideSession } | null; 
     error: string | null 
   }> {
     const idempotencyKey = generateIdempotencyKey(
       'respond-offer',
       offerRequestId
     );
     
     const response = await apiClient.post<any>(
       `/offer-requests/${offerRequestId}/respond`,
       { action },
       { idempotencyKey }
     );
     
     if (isApiSuccess(response)) {
       return { data: response.data, error: null };
     }
     
     return { data: null, error: handleApiError(response) };
   }
   ```

**Action Items:**
- [ ] Create idempotency utility
- [ ] Update apiClient to support idempotency headers
- [ ] Create coordinationService.ts with new methods
- [ ] Create rideSessionService.ts for execution
- [ ] Update all API calls to use idempotency keys

---

## Step 5: Add State Machine Validation

### Create State Machine Utility

```typescript
// src/utils/stateMachine.ts

export class StateTransitionError extends Error {
  constructor(
    public entity: string,
    public currentState: string,
    public attemptedState: string
  ) {
    super(
      `Invalid ${entity} transition: ${currentState} → ${attemptedState}`
    );
    this.name = 'StateTransitionError';
  }
}

export const NeedTransitions: Record<NeedStatus, NeedStatus[]> = {
  OPEN: ['ASSIGNED', 'CANCELLED', 'EXPIRED'],
  ASSIGNED: [], // Terminal
  CANCELLED: [], // Terminal
  EXPIRED: [], // Terminal
};

export function validateNeedTransition(
  current: NeedStatus,
  next: NeedStatus
): void {
  const validNext = NeedTransitions[current] || [];
  if (!validNext.includes(next)) {
    throw new StateTransitionError('Need', current, next);
  }
}

// Similar for other entities
export const AvailabilityTransitions: Record<
  AvailabilityStatus,
  AvailabilityStatus[]
> = {
  ACTIVE: ['CLEARED', 'EXPIRED'],
  CLEARED: [],
  EXPIRED: [],
};

export const OfferRequestTransitions: Record<
  OfferRequestStatus,
  OfferRequestStatus[]
> = {
  SENT: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const RideSessionTransitions: Record<
  RideSessionStatus,
  RideSessionStatus[]
> = {
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
```

**Usage in Components:**
```typescript
// Before updating state
try {
  validateNeedTransition(currentNeed.status, 'CANCELLED');
  await cancelNeed(needId);
} catch (error) {
  if (error instanceof StateTransitionError) {
    Alert.alert('Invalid Action', error.message);
  }
}
```

**Action Items:**
- [ ] Create stateMachine.ts utility
- [ ] Add validation before all status changes
- [ ] Show user-friendly error messages for invalid transitions

---

## Step 6: Update Components

### Update ChildCard Component

Before: Shows child with simple ride status  
After: Shows child with Need status and active RideSession

```typescript
// src/components/ChildCard.tsx
interface ChildCardProps {
  child: Child;
  need?: Need; // NEW
  rideSession?: RideSession; // NEW
  onCreateNeed: () => void; // NEW
  onViewSession: () => void; // NEW
}

export const ChildCard: React.FC<ChildCardProps> = ({
  child,
  need,
  rideSession,
  onCreateNeed,
  onViewSession,
}) => {
  const getStatusInfo = () => {
    if (!need || need.status === 'CANCELLED' || need.status === 'EXPIRED') {
      return { color: Colors.gray400, label: 'No Active Need', action: 'Create Need' };
    }
    
    if (need.status === 'OPEN') {
      return { color: Colors.warning, label: 'Looking for Driver', action: 'View Matches' };
    }
    
    if (need.status === 'ASSIGNED' && rideSession) {
      const statusLabel = getRideSessionStatusLabel(rideSession.sessionStatus);
      return { color: Colors.primary, label: statusLabel, action: 'View Ride' };
    }
    
    return { color: Colors.gray400, label: 'Unknown', action: null };
  };
  
  const status = getStatusInfo();
  
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.childName}>
          {child.firstName} {child.lastInitial}.
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>
      
      {status.action && (
        <Button
          title={status.action}
          onPress={status.action === 'Create Need' ? onCreateNeed : onViewSession}
        />
      )}
    </View>
  );
};
```

**Action Items:**
- [ ] Update ChildCard to accept Need + RideSession
- [ ] Add status badge logic for state machine statuses
- [ ] Create NeedCard component (more detailed view)
- [ ] Create RideSessionCard component

---

## Step 7: Update MorningDashboardScreen

```typescript
// src/screens/MorningDashboardScreen.tsx

export const MorningDashboardScreen: React.FC = () => {
  const { user, currentHouseholdId, getCurrentMember } = useAppStore();
  const { children } = useAppStore();
  const { 
    needs, 
    availabilities, 
    rideSessions,
    getChildNeeds,
    getActiveRideSessions 
  } = useDashboardStore();
  
  const currentMember = getCurrentMember();
  const isDriver = currentMember?.roles.includes('DRIVER');
  
  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      if (!currentHouseholdId) return;
      
      const { data, error } = await fetchMorningDashboard(selectedDate);
      if (data) {
        setNeeds(data.needs);
        setAvailabilities(data.availabilities);
        setRideSessions(data.rideSessions);
      }
    };
    
    loadData();
  }, [selectedDate, currentHouseholdId]);
  
  // Render child with their needs
  const renderChild = (child: Child) => {
    const childNeeds = getChildNeeds(child.id);
    const activeNeed = childNeeds.find(n => 
      n.status === 'OPEN' || n.status === 'ASSIGNED'
    );
    const activeSession = rideSessions.find(rs => 
      rs.needId === activeNeed?.id
    );
    
    return (
      <ChildCard
        key={child.id}
        child={child}
        need={activeNeed}
        rideSession={activeSession}
        onCreateNeed={() => handleCreateNeed(child)}
        onViewSession={() => handleViewSession(activeSession)}
      />
    );
  };
  
  // Handle creating a need
  const handleCreateNeed = async (child: Child) => {
    const { data, error } = await createNeed({
      childId: child.id,
      needType: 'DROP_OFF',
      date: selectedDate,
      windowStartAt: '2026-02-03T07:00:00Z',
      windowEndAt: '2026-02-03T07:30:00Z',
    });
    
    if (data) {
      // Refresh dashboard
      loadDashboard();
    } else {
      Alert.alert('Error', error);
    }
  };
  
  // ...rest of component
};
```

**Action Items:**
- [ ] Update dashboard to use getCurrentMember()
- [ ] Load needs, availabilities, rideSessions separately
- [ ] Use getChildNeeds() helper for child-specific needs
- [ ] Update handlers to use new API methods

---

## Step 8: Add Care Credits Event Display

```typescript
// src/screens/ProfileScreen.tsx

const [recentCredits, setRecentCredits] = useState<CareCreditEvent[]>([]);

useEffect(() => {
  const loadCredits = async () => {
    const { data } = await getCareCreditsProfile();
    if (data) {
      setRecentCredits(data.recentEvents);
    }
  };
  
  loadCredits();
}, []);

// In render
<View style={styles.creditsHistory}>
  <Text style={styles.historyTitle}>Recent Contributions</Text>
  {recentCredits.map(credit => (
    <View key={credit.id} style={styles.creditEvent}>
      <Text style={styles.eventType}>
        {getEventTypeLabel(credit.eventType)}
      </Text>
      <Text style={styles.eventDate}>
        {formatDate(credit.eventAt)}
      </Text>
      <Text style={styles.eventUnits}>+{credit.units}</Text>
    </View>
  ))}
</View>
```

**Action Items:**
- [ ] Update Profile to fetch CareCreditSummary
- [ ] Display recent CareCreditEvents
- [ ] Add reliability indicators (completion rate, on-time rate)

---

## Testing Checklist

After migration, verify:

- [ ] App loads without errors
- [ ] Can view children with no needs
- [ ] Can create a need for a child
- [ ] Need shows "OPEN" status
- [ ] Can create driver availability (if driver role)
- [ ] Can accept an offer (transitions need to ASSIGNED)
- [ ] Can update ride status (ARRIVED, PICKED_UP, DROPPED_OFF)
- [ ] DROPPED_OFF triggers Care Credit (check profile)
- [ ] Care Credits display correctly
- [ ] Idempotency works (retry doesn't create duplicates)
- [ ] State machine prevents invalid transitions

---

## Rollback Plan

If migration causes issues:

1. **Revert domain types**: `git checkout HEAD~1 -- src/types/domain.ts`
2. **Revert stores**: `git checkout HEAD~1 -- src/store/`
3. **Revert services**: `git checkout HEAD~1 -- src/services/`
4. **Keep documentation**: New docs are forward-looking, safe to keep

---

## Timeline Estimate

- **Step 1-2 (Types & Store)**: 2-4 hours
- **Step 3-4 (Entities & API)**: 4-6 hours
- **Step 5 (State Machines)**: 2-3 hours
- **Step 6-7 (Components & Screens)**: 6-8 hours
- **Step 8 (Care Credits)**: 2-3 hours
- **Testing**: 4-6 hours

**Total**: 20-30 hours for complete migration

---

**Next Steps:**
1. Review this migration guide
2. Create a feature branch: `git checkout -b architecture-v2`
3. Follow steps 1-8 sequentially
4. Test thoroughly before merging
5. Update CHECKLIST.md to mark v2 items complete

**Last Updated:** February 2, 2026
