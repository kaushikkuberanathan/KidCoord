-- KidCoord Database Schema v2.0
-- PostgreSQL 14+
-- Event-driven, audit-first architecture with state machines

-- ============================================================================
-- A. IDENTITY & ACCESS
-- ============================================================================

CREATE TABLE users (
    user_id VARCHAR(64) PRIMARY KEY,
    phone_hash VARCHAR(128) UNIQUE,
    email_hash VARCHAR(128) UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_phone_hash ON users(phone_hash);
CREATE INDEX idx_users_email_hash ON users(email_hash);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    device_id VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- B. HOUSEHOLD SETUP
-- ============================================================================

CREATE TABLE households (
    household_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_households_status ON households(status);

CREATE TABLE household_members (
    household_member_id VARCHAR(64) PRIMARY KEY,
    household_id VARCHAR(64) NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    roles TEXT[] NOT NULL DEFAULT '{}', -- ['PARENT', 'DRIVER', 'HOST', 'ADMIN']
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(household_id, user_id)
);

CREATE INDEX idx_household_members_household_id ON household_members(household_id);
CREATE INDEX idx_household_members_user_id ON household_members(user_id);
CREATE INDEX idx_household_members_status ON household_members(status);

CREATE TABLE children (
    child_id VARCHAR(64) PRIMARY KEY,
    household_id VARCHAR(64) NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    first_name VARCHAR(128) NOT NULL,
    last_initial VARCHAR(1),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_children_household_id ON children(household_id);
CREATE INDEX idx_children_status ON children(status);

CREATE TABLE vehicles (
    vehicle_id VARCHAR(64) PRIMARY KEY,
    household_id VARCHAR(64) NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    seat_capacity INTEGER NOT NULL CHECK (seat_capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_household_id ON vehicles(household_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);

CREATE TABLE vehicle_drivers (
    vehicle_driver_id VARCHAR(64) PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    household_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(vehicle_id, household_member_id)
);

CREATE INDEX idx_vehicle_drivers_vehicle_id ON vehicle_drivers(vehicle_id);
CREATE INDEX idx_vehicle_drivers_member_id ON vehicle_drivers(household_member_id);

-- ============================================================================
-- C. REGISTRY (Admin-managed, versioned)
-- ============================================================================

CREATE TABLE schools (
    school_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schools_status ON schools(status);

CREATE TABLE routes (
    route_id VARCHAR(64) PRIMARY KEY,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(school_id, code)
);

CREATE INDEX idx_routes_school_id ON routes(school_id);
CREATE INDEX idx_routes_status ON routes(status);

CREATE TABLE stops (
    stop_id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    geo_lat DECIMAL(10, 7),
    geo_lng DECIMAL(10, 7),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stops_route_id ON stops(route_id);
CREATE INDEX idx_stops_status ON stops(status);

CREATE TABLE communities (
    community_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_status ON communities(status);

CREATE TABLE child_school_profiles (
    child_school_profile_id VARCHAR(64) PRIMARY KEY,
    child_id VARCHAR(64) NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,
    school_id VARCHAR(64) NOT NULL REFERENCES schools(school_id),
    route_id VARCHAR(64) NOT NULL REFERENCES routes(route_id),
    stop_id VARCHAR(64) NOT NULL REFERENCES stops(stop_id),
    community_id VARCHAR(64) REFERENCES communities(community_id),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Constraint: stop must belong to route
    CONSTRAINT fk_stop_route CHECK (
        EXISTS (
            SELECT 1 FROM stops s 
            WHERE s.stop_id = child_school_profiles.stop_id 
            AND s.route_id = child_school_profiles.route_id
        )
    )
);

CREATE INDEX idx_child_school_profiles_child_id ON child_school_profiles(child_id);
CREATE INDEX idx_child_school_profiles_school_id ON child_school_profiles(school_id);
CREATE INDEX idx_child_school_profiles_route_id ON child_school_profiles(route_id);
CREATE INDEX idx_child_school_profiles_stop_id ON child_school_profiles(stop_id);

CREATE TABLE registry_versions (
    registry_version_id VARCHAR(64) PRIMARY KEY,
    version VARCHAR(64) NOT NULL UNIQUE,
    published_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE registry_import_jobs (
    import_job_id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'validating', 'applied', 'failed')),
    created_by_user_id VARCHAR(64) NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_report JSONB
);

CREATE INDEX idx_registry_import_jobs_status ON registry_import_jobs(status);

-- ============================================================================
-- D. COORDINATION ENGINE (MVP: AM Drop-Off)
-- ============================================================================

CREATE TABLE needs (
    need_id VARCHAR(64) PRIMARY KEY,
    household_id VARCHAR(64) NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    child_id VARCHAR(64) NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,
    need_type VARCHAR(20) NOT NULL CHECK (need_type IN ('DROP_OFF', 'PICKUP', 'HOSTING')),
    date DATE NOT NULL,
    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'ASSIGNED', 'CANCELLED', 'EXPIRED')),
    created_by_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Constraint: Only one OPEN/ASSIGNED Need per child per date
    CONSTRAINT unique_active_need_per_child_date 
        UNIQUE (child_id, date, status) 
        WHERE (status IN ('OPEN', 'ASSIGNED'))
);

CREATE INDEX idx_needs_household_id ON needs(household_id);
CREATE INDEX idx_needs_child_id ON needs(child_id);
CREATE INDEX idx_needs_date ON needs(date);
CREATE INDEX idx_needs_status ON needs(status);
CREATE INDEX idx_needs_date_status ON needs(date, status);

CREATE TABLE availabilities (
    availability_id VARCHAR(64) PRIMARY KEY,
    household_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    window_start_at TIMESTAMP NOT NULL,
    window_end_at TIMESTAMP NOT NULL,
    seat_capacity_at_time INTEGER NOT NULL CHECK (seat_capacity_at_time > 0),
    seats_available INTEGER NOT NULL CHECK (seats_available >= 0),
    preference_school_id VARCHAR(64) REFERENCES schools(school_id),
    preference_route_id VARCHAR(64) REFERENCES routes(route_id),
    preference_stop_id VARCHAR(64) REFERENCES stops(stop_id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'CLEARED', 'EXPIRED')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Constraint: No overlapping ACTIVE windows per driver per date
    EXCLUDE USING gist (
        household_member_id WITH =,
        date WITH =,
        tsrange(window_start_at, window_end_at) WITH &&
    ) WHERE (status = 'ACTIVE')
);

CREATE INDEX idx_availabilities_member_id ON availabilities(household_member_id);
CREATE INDEX idx_availabilities_vehicle_id ON availabilities(vehicle_id);
CREATE INDEX idx_availabilities_date ON availabilities(date);
CREATE INDEX idx_availabilities_status ON availabilities(status);
CREATE INDEX idx_availabilities_date_status ON availabilities(date, status);

CREATE TABLE offer_requests (
    offer_request_id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('OFFER', 'REQUEST')),
    need_id VARCHAR(64) NOT NULL REFERENCES needs(need_id) ON DELETE CASCADE,
    availability_id VARCHAR(64) NOT NULL REFERENCES availabilities(availability_id) ON DELETE CASCADE,
    from_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    to_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Constraint: Only one ACCEPTED per need
    CONSTRAINT unique_accepted_per_need 
        UNIQUE (need_id, status) 
        WHERE (status = 'ACCEPTED')
);

CREATE INDEX idx_offer_requests_need_id ON offer_requests(need_id);
CREATE INDEX idx_offer_requests_availability_id ON offer_requests(availability_id);
CREATE INDEX idx_offer_requests_from_member_id ON offer_requests(from_member_id);
CREATE INDEX idx_offer_requests_to_member_id ON offer_requests(to_member_id);
CREATE INDEX idx_offer_requests_status ON offer_requests(status);

CREATE TABLE ride_sessions (
    ride_session_id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL,
    need_id VARCHAR(64) NOT NULL REFERENCES needs(need_id),
    driver_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(vehicle_id),
    seat_count_reserved INTEGER NOT NULL CHECK (seat_count_reserved > 0),
    session_status VARCHAR(20) NOT NULL CHECK (session_status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    assigned_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ride_sessions_date ON ride_sessions(date);
CREATE INDEX idx_ride_sessions_need_id ON ride_sessions(need_id);
CREATE INDEX idx_ride_sessions_driver_member_id ON ride_sessions(driver_member_id);
CREATE INDEX idx_ride_sessions_session_status ON ride_sessions(session_status);
CREATE INDEX idx_ride_sessions_date_status ON ride_sessions(date, session_status);

CREATE TABLE ride_participants (
    ride_participant_id VARCHAR(64) PRIMARY KEY,
    ride_session_id VARCHAR(64) NOT NULL REFERENCES ride_sessions(ride_session_id) ON DELETE CASCADE,
    household_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    role_in_session VARCHAR(20) NOT NULL CHECK (role_in_session IN ('REQUESTER_PARENT', 'DRIVER')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ride_participants_session_id ON ride_participants(ride_session_id);
CREATE INDEX idx_ride_participants_member_id ON ride_participants(household_member_id);

CREATE TABLE ride_status_events (
    ride_status_event_id VARCHAR(64) PRIMARY KEY,
    ride_session_id VARCHAR(64) NOT NULL REFERENCES ride_sessions(ride_session_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ARRIVED', 'PICKED_UP', 'DROPPED_OFF', 'DELAYED')),
    actor_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    event_at TIMESTAMP NOT NULL,
    geo_lat DECIMAL(10, 7),
    geo_lng DECIMAL(10, 7),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ride_status_events_session_id ON ride_status_events(ride_session_id);
CREATE INDEX idx_ride_status_events_event_at ON ride_status_events(event_at);
CREATE INDEX idx_ride_status_events_status ON ride_status_events(status);

-- ============================================================================
-- E. CARE CREDITS (Event-driven, idempotent)
-- ============================================================================

CREATE TABLE care_credit_events (
    care_credit_event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('RIDE_COMPLETED')),
    actor_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    beneficiary_member_id VARCHAR(64) REFERENCES household_members(household_member_id),
    household_id VARCHAR(64) REFERENCES households(household_id),
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('RIDE_SESSION')),
    context_id VARCHAR(64) NOT NULL,
    units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
    event_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    -- Constraint: Idempotent - one event per context + actor
    UNIQUE(context_type, context_id, actor_member_id, event_type)
);

CREATE INDEX idx_care_credit_events_actor_member_id ON care_credit_events(actor_member_id);
CREATE INDEX idx_care_credit_events_beneficiary_member_id ON care_credit_events(beneficiary_member_id);
CREATE INDEX idx_care_credit_events_event_at ON care_credit_events(event_at);
CREATE INDEX idx_care_credit_events_context ON care_credit_events(context_type, context_id);

CREATE TABLE care_credit_summaries (
    household_member_id VARCHAR(64) PRIMARY KEY REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    total_earned INTEGER NOT NULL DEFAULT 0,
    by_event_type JSONB NOT NULL DEFAULT '{}',
    last_calculated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE care_credit_pair_balances (
    member_a_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    member_b_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    net_units INTEGER NOT NULL DEFAULT 0,
    last_event_at TIMESTAMP NOT NULL,
    PRIMARY KEY (member_a_id, member_b_id),
    CHECK (member_a_id < member_b_id) -- Ensure consistent ordering
);

CREATE INDEX idx_care_credit_pair_balances_member_a ON care_credit_pair_balances(member_a_id);
CREATE INDEX idx_care_credit_pair_balances_member_b ON care_credit_pair_balances(member_b_id);

-- ============================================================================
-- F. SAFETY & TRUST
-- ============================================================================

CREATE TABLE blocklists (
    blocklist_id VARCHAR(64) PRIMARY KEY,
    child_id VARCHAR(64) NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,
    blocked_household_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    created_by_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(child_id, blocked_household_member_id, status) WHERE (status = 'active')
);

CREATE INDEX idx_blocklists_child_id ON blocklists(child_id);
CREATE INDEX idx_blocklists_blocked_member_id ON blocklists(blocked_household_member_id);
CREATE INDEX idx_blocklists_status ON blocklists(status);

CREATE TABLE verifications (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    verification_level VARCHAR(50) NOT NULL,
    verified_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- G. NOTIFICATIONS + REALTIME
-- ============================================================================

CREATE TABLE notification_preferences (
    household_member_id VARCHAR(64) NOT NULL REFERENCES household_members(household_member_id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL CHECK (category IN ('REQUESTS', 'ACCEPTANCE', 'STATUS', 'DELAYS', 'COMPLETION', 'CARE_CREDITS')),
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    PRIMARY KEY (household_member_id, category)
);

CREATE TABLE notifications (
    notification_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    deep_link TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('CREATED', 'SENT', 'FAILED', 'READ')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    provider_message_id VARCHAR(255)
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE TABLE outbox_events (
    outbox_event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_outbox_events_status ON outbox_events(status);
CREATE INDEX idx_outbox_events_created_at ON outbox_events(created_at);

-- ============================================================================
-- H. AUDIT + OBSERVABILITY
-- ============================================================================

CREATE TABLE audit_events (
    audit_event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    actor_user_id VARCHAR(64) REFERENCES users(user_id),
    actor_member_id VARCHAR(64) REFERENCES household_members(household_member_id),
    household_id VARCHAR(64) REFERENCES households(household_id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    event_at TIMESTAMP NOT NULL DEFAULT NOW(),
    device_id VARCHAR(128),
    ip_hash VARCHAR(128),
    metadata JSONB,
    integrity_hash VARCHAR(128)
);

CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_actor_user_id ON audit_events(actor_user_id);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_event_at ON audit_events(event_at);

CREATE TABLE idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id),
    route VARCHAR(255) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_keys_user_id ON idempotency_keys(user_id);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_household_members_updated_at BEFORE UPDATE ON household_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_needs_updated_at BEFORE UPDATE ON needs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availabilities_updated_at BEFORE UPDATE ON availabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_requests_updated_at BEFORE UPDATE ON offer_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_sessions_updated_at BEFORE UPDATE ON ride_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired idempotency keys (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_needs_household_date_status ON needs(household_id, date, status);
CREATE INDEX idx_availabilities_member_date_status ON availabilities(household_member_id, date, status);
CREATE INDEX idx_ride_sessions_driver_date ON ride_sessions(driver_member_id, date);
CREATE INDEX idx_care_credit_events_actor_event_at ON care_credit_events(actor_member_id, event_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE needs IS 'Child needs coordination (drop-off, pickup, hosting). State machine: OPEN → ASSIGNED → terminal';
COMMENT ON TABLE availabilities IS 'Driver availability. State machine: ACTIVE → CLEARED/EXPIRED';
COMMENT ON TABLE offer_requests IS 'Connects needs with availability. State machine: SENT → ACCEPTED/DECLINED/etc';
COMMENT ON TABLE ride_sessions IS 'Execution unit. State machine: ASSIGNED → IN_PROGRESS → COMPLETED';
COMMENT ON TABLE ride_status_events IS 'Append-only timeline of ride progress. No state machine, only additions';
COMMENT ON TABLE care_credit_events IS 'Immutable contribution records. Idempotent via unique constraint';
COMMENT ON TABLE outbox_events IS 'Reliability pattern. Guarantees async operations (notifications, credits)';
COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate requests from mobile clients';

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT (OPTIONAL)
-- ============================================================================

-- Uncomment to insert sample data
/*
INSERT INTO users (user_id, display_name, phone_hash, status, is_admin) VALUES
('user_001', 'Jane Doe', hash_phone('+1234567890'), 'active', false),
('user_002', 'John Smith', hash_phone('+1234567891'), 'active', false),
('admin_001', 'Admin User', hash_phone('+1234567892'), 'active', true);

INSERT INTO households (household_id, name, status) VALUES
('household_001', 'Doe Family', 'active'),
('household_002', 'Smith Family', 'active');

INSERT INTO household_members (household_member_id, household_id, user_id, roles, status) VALUES
('member_001', 'household_001', 'user_001', ARRAY['PARENT', 'DRIVER'], 'active'),
('member_002', 'household_002', 'user_002', ARRAY['PARENT', 'DRIVER'], 'active');

INSERT INTO schools (school_id, name, status) VALUES
('school_001', 'Lincoln Elementary', 'active');

INSERT INTO routes (route_id, school_id, code, status) VALUES
('route_001', 'school_001', 'BUS-101', 'active');

INSERT INTO stops (stop_id, route_id, name, status) VALUES
('stop_001', 'route_001', 'Oak Street & 5th Ave', 'active');
*/
