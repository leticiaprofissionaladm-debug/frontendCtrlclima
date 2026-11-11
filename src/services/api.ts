
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(
        'API Error:',
        error.response.status,
        error.response.data,
      );
    } else if (error.request) {
      console.error('The API server did not respond.');
    } else {
      console.error('Request error:', error.message);
    }

    return Promise.reject(error);
  },
);

export function extrairMensagemErro(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (!error.response) {
      return 'Unable to connect to the server. Please try again later.';
    }
  }

  return 'An unexpected error occurred.';
}
