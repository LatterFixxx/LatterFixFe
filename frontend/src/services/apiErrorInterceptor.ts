/**
 * Global Axios Response Interceptor
 *
 * Intercepts HTTP 4xx/5xx responses and surfaces them as toast notifications
 * so users get actionable feedback without checking the console.
 *
 * Import once from main.tsx to activate:
 *   import './services/apiErrorInterceptor';
 */
import axios from 'axios';
import { toast } from 'sonner';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad request — check your input and try again.',
  401: 'Session expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'Request timed out. Please try again.',
  409: 'Conflict — the resource may have changed. Please refresh.',
  422: 'The submitted data is invalid. Please review your input.',
  429: 'Too many requests. Please wait a moment before trying again.',
  500: 'Internal server error. Please try again later.',
  502: 'Gateway error — the backend service is temporarily unavailable.',
  503: 'Service unavailable. Please try again later.',
};

function getDefaultMessage(status: number): string {
  return STATUS_MESSAGES[status] || `Unexpected error (HTTP ${status}). Please try again.`;
}

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url ?? '';

      // Skip toast for localhost/dev requests — they're expected to be noisy
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return Promise.reject(error);
      }

      // Skip toast for 401 on auth-related endpoints (handled by AuthProvider)
      if (status === 401 && (url.includes('/auth') || url.includes('/login'))) {
        return Promise.reject(error);
      }

      // Skip toast for contract registry errors (handled by ContractService retry logic)
      if (url.includes('/api/contracts')) {
        return Promise.reject(error);
      }

      const message = error.response?.data &&
        typeof error.response.data === 'object' &&
        'message' in (error.response.data as Record<string, unknown>)
        ? (error.response.data as Record<string, string>).message
        : getDefaultMessage(status ?? 0);

      if (status && status >= 500) {
        toast.error('Server error', { description: message });
      } else if (status === 401 || status === 403) {
        toast.error('Access denied', { description: message });
      } else if (status && status >= 400) {
        toast.error('Request failed', { description: message });
      }
    }

    return Promise.reject(error);
  }
);