/**
 * Dashboard Service
 * API methods for morning coordination
 */

import { apiClient, handleApiError, isApiSuccess } from './apiClient';
import {
  MorningDashboardRequest,
  MorningDashboardResponse,
  CreateRideRequestRequest,
  CreateAvailabilityRequest,
  AssignRideRequest,
  UpdateRideStatusRequest,
  MarkChildHasRideRequest,
  CancelRideRequestRequest,
  CancelAvailabilityRequest,
} from '@/types/api';
import { RideRequest, DriverAvailability, Ride } from '@/types/domain';

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export async function fetchMorningDashboard(
  date: string
): Promise<{ data: MorningDashboardResponse | null; error: string | null }> {
  const response = await apiClient.post<MorningDashboardResponse>(
    '/dashboard/morning',
    { date } as MorningDashboardRequest
  );

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}

// ============================================================================
// RIDE REQUESTS
// ============================================================================

export async function createRideRequest(
  request: CreateRideRequestRequest
): Promise<{ data: RideRequest | null; error: string | null }> {
  const response = await apiClient.post<RideRequest>('/rides/request', request);

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}

export async function cancelRideRequest(
  request: CancelRideRequestRequest
): Promise<{ success: boolean; error: string | null }> {
  const response = await apiClient.post<void>('/rides/request/cancel', request);

  if (isApiSuccess(response)) {
    return { success: true, error: null };
  }

  return { success: false, error: handleApiError(response) };
}

export async function markChildHasRide(
  request: MarkChildHasRideRequest
): Promise<{ success: boolean; error: string | null }> {
  const response = await apiClient.post<void>('/rides/has-ride', request);

  if (isApiSuccess(response)) {
    return { success: true, error: null };
  }

  return { success: false, error: handleApiError(response) };
}

// ============================================================================
// DRIVER AVAILABILITY
// ============================================================================

export async function createAvailability(
  request: CreateAvailabilityRequest
): Promise<{ data: DriverAvailability | null; error: string | null }> {
  const response = await apiClient.post<DriverAvailability>(
    '/availability/create',
    request
  );

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}

export async function cancelAvailability(
  request: CancelAvailabilityRequest
): Promise<{ success: boolean; error: string | null }> {
  const response = await apiClient.post<void>('/availability/cancel', request);

  if (isApiSuccess(response)) {
    return { success: true, error: null };
  }

  return { success: false, error: handleApiError(response) };
}

// ============================================================================
// RIDE ASSIGNMENT & EXECUTION
// ============================================================================

export async function assignRide(
  request: AssignRideRequest
): Promise<{ data: Ride | null; error: string | null }> {
  const response = await apiClient.post<Ride>('/rides/assign', request);

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}

export async function updateRideStatus(
  request: UpdateRideStatusRequest
): Promise<{ data: Ride | null; error: string | null }> {
  const response = await apiClient.post<Ride>('/rides/status', request);

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}

// ============================================================================
// MATCHING
// ============================================================================

export async function getMatching(date: string, schoolId: string) {
  const response = await apiClient.get<any>(
    `/matching?date=${date}&schoolId=${schoolId}`
  );

  if (isApiSuccess(response)) {
    return { data: response.data, error: null };
  }

  return { data: null, error: handleApiError(response) };
}
