import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
});

// Request interceptor: inject Bearer token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('tunnel_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tunnel_auth_token');
      localStorage.removeItem('tunnel_auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default client;
