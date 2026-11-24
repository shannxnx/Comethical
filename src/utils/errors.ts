import { AppError } from '@/types/game';

const FRIENDLY: Record<string, string> = {
  network: 'You seem to be offline. Check your connection and try again.',
  timeout: 'The server is taking too long. Check your connection and try again.',
  session_expired: 'Your session has expired. Please sign in again.',
  unauthenticated: 'Please sign in to continue.',
  empty_bank: 'No scenarios are available for this mode right now. Try another mode or check back later.',
  rate_limited: 'You are going a little fast. Take a short break and try again.',
  session_not_active: 'This session has already ended.',
};

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    const friendly = FRIENDLY[error.code];
    return friendly ? new AppError(error.code, friendly, error.retryable) : error;
  }
  if (error instanceof Error) return new AppError('unknown', error.message || 'Something went wrong.', true);
  return new AppError('unknown', 'Something went wrong.', true);
}
