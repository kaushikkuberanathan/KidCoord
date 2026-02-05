-- Registry Seed Data - Brookwood Elementary School
-- Forsyth County, GA
-- Run this after schema.sql to populate registry tables with sample data

-- ============================================================================
-- SCHOOL - Brookwood Elementary
-- ============================================================================

INSERT INTO schools (school_id, name, address, city, state, zip, district, status, created_at)
VALUES
  ('school_brookwood', 'Brookwood Elementary School', '5850 Brookwood Rd', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW());

-- ============================================================================
-- ROUTES - Brookwood Elementary
-- Based on actual Forsyth County bus routes
-- Route 14702 is a REAL bus route serving Brookwood Elementary
-- ============================================================================

INSERT INTO routes (route_id, school_id, name, description, status, created_at)
VALUES
  -- REAL ROUTE from bus tracker
  ('route_14702', 'school_brookwood', 'Route 14702', 'Real Forsyth County bus route - Claiborne Farm area, pickup 6:39 AM', 'active', NOW()),
  
  -- Additional sample routes for testing
  ('route_001', 'school_brookwood', 'North Brookwood', 'Covers areas north of school: Shiloh area, Hurt Bridge communities', 'active', NOW()),
  ('route_002', 'school_brookwood', 'South Brookwood', 'Covers areas south of school: Pilgrim Mill, Castleberry areas', 'active', NOW()),
  ('route_003', 'school_brookwood', 'East Brookwood', 'Covers areas east of school: Settingdown Creek, Matt area', 'active', NOW()),
  ('route_004', 'school_brookwood', 'West Brookwood', 'Covers areas west of school: Brookwood Parkway, Haw Creek areas', 'active', NOW()),
  ('route_005', 'school_brookwood', 'Central Brookwood', 'Covers neighborhoods immediately around school on Brookwood Rd', 'active', NOW());

-- ============================================================================
-- STOPS - Route 14702 (REAL BUS ROUTE)
-- Based on the bus tracker map showing pickup locations
-- ============================================================================

-- Route 14702 - Real bus stops from map
INSERT INTO stops (stop_id, route_id, name, address, city, state, zip, latitude, longitude, status, created_at)
VALUES
  -- Primary pickup location shown on map (Claiborne Farm Rd area)
  ('stop_14702_1', 'route_14702', 'Claiborne Farm Rd Pickup', 'Claiborne Farm Rd near Millbrook Ct', 'Cumming', 'GA', '30040', 34.1780, -84.1420, 'active', NOW()),
  
  -- Secondary pickup location from map
  ('stop_14702_2', 'route_14702', 'Route 14702 South Stop', 'Claiborne Farm Rd (south)', 'Cumming', 'GA', '30040', 34.1595, -84.1445, 'active', NOW()),

-- Route 001 - North Brookwood stops
INSERT INTO stops (stop_id, route_id, name, address, city, state, zip, latitude, longitude, status, created_at)
VALUES
  ('stop_001', 'route_001', 'Shiloh Road & Hurt Bridge', 'Shiloh Rd & Hurt Bridge Rd', 'Cumming', 'GA', '30040', 34.1523, -84.1245, 'active', NOW()),
  ('stop_002', 'route_001', 'Shiloh Community Center', 'Shiloh Rd & Shiloh Point Elementary', 'Cumming', 'GA', '30040', 34.1489, -84.1289, 'active', NOW()),
  ('stop_003', 'route_001', 'Hurt Bridge & Polo Fields', 'Hurt Bridge Rd & Polo Fields Pkwy', 'Cumming', 'GA', '30040', 34.1456, -84.1312, 'active', NOW()),

-- Route 002 - South Brookwood stops
  ('stop_004', 'route_002', 'Pilgrim Mill & Matt Hwy', 'Pilgrim Mill Rd & Matt Hwy', 'Cumming', 'GA', '30040', 34.1234, -84.1345, 'active', NOW()),
  ('stop_005', 'route_002', 'Castleberry & Brookwood', 'Castleberry Rd & Brookwood Rd', 'Cumming', 'GA', '30040', 34.1267, -84.1298, 'active', NOW()),
  ('stop_006', 'route_002', 'Castleberry Industrial', 'Castleberry Industrial Blvd & Hwy 20', 'Cumming', 'GA', '30040', 34.1289, -84.1267, 'active', NOW()),

-- Route 003 - East Brookwood stops
  ('stop_007', 'route_003', 'Matt Highway & Settingdown', 'Matt Hwy & Settingdown Rd', 'Cumming', 'GA', '30040', 34.1378, -84.1123, 'active', NOW()),
  ('stop_008', 'route_003', 'Settingdown Creek Park', 'Settingdown Rd & McFarland Pkwy', 'Cumming', 'GA', '30040', 34.1401, -84.1089, 'active', NOW()),
  ('stop_009', 'route_003', 'Matt & Coal Mountain', 'Matt Hwy & Coal Mountain Dr', 'Cumming', 'GA', '30040', 34.1334, -84.1156, 'active', NOW()),

-- Route 004 - West Brookwood stops
  ('stop_010', 'route_004', 'Brookwood Parkway North', 'Brookwood Pkwy & Brookwood Club Dr', 'Cumming', 'GA', '30040', 34.1423, -84.1467, 'active', NOW()),
  ('stop_011', 'route_004', 'Haw Creek & Brookwood', 'Haw Creek Rd & Brookwood Rd', 'Cumming', 'GA', '30040', 34.1389, -84.1423, 'active', NOW()),
  ('stop_012', 'route_004', 'Brookwood Parkway South', 'Brookwood Pkwy & Pilgrim Mill Rd', 'Cumming', 'GA', '30040', 34.1312, -84.1445, 'active', NOW()),

-- Route 005 - Central Brookwood stops
  ('stop_013', 'route_005', 'Brookwood & Bethelview', 'Brookwood Rd & Bethelview Rd', 'Cumming', 'GA', '30040', 34.1367, -84.1334, 'active', NOW()),
  ('stop_014', 'route_005', 'Brookwood Elementary Main', '5850 Brookwood Rd (school entrance)', 'Cumming', 'GA', '30040', 34.1356, -84.1312, 'active', NOW()),
  ('stop_015', 'route_005', 'Brookwood & Hwy 20', 'Brookwood Rd & Atlanta Hwy (Hwy 20)', 'Cumming', 'GA', '30040', 34.1323, -84.1301, 'active', NOW());

-- ============================================================================
-- COMMUNITIES - Neighborhoods near Brookwood Elementary
-- Forsyth County neighborhoods and subdivisions
-- ============================================================================

INSERT INTO communities (community_id, name, city, state, zip, community_type, status, created_at)
VALUES
  -- Major subdivisions near Brookwood Elementary
  ('comm_001', 'Brookwood Club', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_002', 'Polo Fields', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_003', 'Settingdown Creek', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_004', 'Shiloh Green', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_005', 'Windermere', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_006', 'Copper Ridge', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_007', 'Bentwater', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_008', 'Hampton Oaks', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_009', 'Meadow Creek', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_010', 'Pilgrim Mill', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_011', 'Castleberry Hills', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_012', 'Haw Creek', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_013', 'Brookwood Estates', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW()),
  ('comm_014', 'Forest Creek', 'Cumming', 'GA', '30040', 'NEIGHBORHOOD', 'active', NOW()),
  ('comm_015', 'Silver Creek', 'Cumming', 'GA', '30040', 'HOA', 'active', NOW());

-- ============================================================================
-- ADDITIONAL FORSYTH COUNTY SCHOOLS (for multi-school households)
-- ============================================================================

INSERT INTO schools (school_id, name, address, city, state, zip, district, status, created_at)
VALUES
  -- Other Elementary Schools in area
  ('school_shiloh', 'Shiloh Point Elementary', '5825 Shiloh Rd', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW()),
  ('school_settingdown', 'Settingdown Elementary', '2805 Settingdown Rd', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW()),
  ('school_matt', 'Matt Elementary', '5055 Matt Hwy', 'Cumming', 'GA', '30028', 'Forsyth County Schools', 'active', NOW()),
  
  -- Middle Schools
  ('school_riverwatch', 'Riverwatch Middle School', '6505 Riverwatch Pkwy', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW()),
  ('school_piney_grove', 'Piney Grove Middle School', '5325 Keithwood Dr', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW()),
  
  -- High Schools
  ('school_forsyth_central', 'Forsyth Central High School', '520 Tribble Gap Rd', 'Cumming', 'GA', '30040', 'Forsyth County Schools', 'active', NOW()),
  ('school_south_forsyth', 'South Forsyth High School', '585 Peachtree Pkwy', 'Cumming', 'GA', '30041', 'Forsyth County Schools', 'active', NOW()),
  ('school_west_forsyth', 'West Forsyth High School', '4155 Drew Rd', 'Cumming', 'GA', '30028', 'Forsyth County Schools', 'active', NOW());

-- ============================================================================
-- ROUTES FOR ADDITIONAL SCHOOLS (sample)
-- ============================================================================

-- Shiloh Point Elementary
INSERT INTO routes (route_id, school_id, name, description, status, created_at)
VALUES
  ('route_101', 'school_shiloh', 'North Shiloh', 'Northern Shiloh Point coverage area', 'active', NOW()),
  ('route_102', 'school_shiloh', 'South Shiloh', 'Southern Shiloh Point coverage area', 'active', NOW());

-- Riverwatch Middle School
INSERT INTO routes (route_id, school_id, name, description, status, created_at)
VALUES
  ('route_201', 'school_riverwatch', 'Riverwatch District North', 'Northern middle school zone', 'active', NOW()),
  ('route_202', 'school_riverwatch', 'Riverwatch District South', 'Southern middle school zone', 'active', NOW());

-- Forsyth Central High School
INSERT INTO routes (route_id, school_id, name, description, status, created_at)
VALUES
  ('route_301', 'school_forsyth_central', 'Forsyth Central District', 'Main high school attendance zone', 'active', NOW());

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created:
-- - 9 Forsyth County schools (elementary through high school)
-- - 6 routes for Brookwood Elementary (including REAL Route 14702!)
-- - 17 stops covering major neighborhoods around Brookwood
-- - 15 communities/neighborhoods in the Brookwood area
-- - Additional routes for nearby schools
--
-- REAL DATA:
-- - Route 14702 is the actual Forsyth County bus route
-- - Pickup time: 6:39 AM (from bus tracker)
-- - Location: Claiborne Farm Rd area
-- - Source: https://fcss.maps.arcgis.com/apps/webappviewer/index.html?id=a8e7208bfc9044629246e00e73855a38
--
-- Usage:
-- psql kidcoord < backend/migrations/002_seed_registry.sql
--
-- This provides realistic testing data for:
-- - Child school profiles (link to Brookwood Elementary)
-- - Route selection during availability creation (use Route 14702!)
-- - Stop selection for pickup/dropoff (real bus stops)
-- - Community-based parent matching
-- ============================================================================
