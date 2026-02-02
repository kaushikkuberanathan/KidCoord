/**
 * Date & Time Utilities
 * Helper functions for time windows, formatting, and comparisons
 */

import { format, parseISO, isToday, isTomorrow, formatDistanceToNow } from 'date-fns';

/**
 * Format date for display
 */
export function formatDate(date: string | Date, formatStr: string = 'MMMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format time for display (e.g., "7:30 AM")
 */
export function formatTime(time: string): string {
  // Assumes time is in "HH:mm" format
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Check if date is today
 */
export function isDateToday(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isToday(dateObj);
}

/**
 * Check if date is tomorrow
 */
export function isDateTomorrow(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isTomorrow(dateObj);
}

/**
 * Get relative time string (e.g., "in 5 minutes", "2 hours ago")
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Get current date in ISO format (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get tomorrow's date in ISO format
 */
export function getTomorrowISO(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Check if time is within window
 */
export function isTimeInWindow(
  time: string,
  windowStart: string,
  windowEnd: string
): boolean {
  return time >= windowStart && time <= windowEnd;
}

/**
 * Calculate duration between times in minutes
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

/**
 * Format time window for display
 */
export function formatTimeWindow(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Get morning greeting based on time
 */
export function getMorningGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Check if it's currently morning drop-off time
 */
export function isMorningDropOffTime(): boolean {
  const hour = new Date().getHours();
  // Consider 6 AM - 9 AM as drop-off time
  return hour >= 6 && hour < 9;
}
