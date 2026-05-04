
import axios from 'axios';
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseURL = isDev ? (process.env.REACT_APP_API_URL || '/api') : '/api';
const client = axios.create({ baseURL });
client.interceptors.request.use(cfg => {
  const t = localStorage.getItem('timein_token');
  if (t) cfg.headers.Authorization = 'Bearer ' + t;
  return cfg;
});
client.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) { localStorage.removeItem('timein_token'); window.location.href = '/login'; }
    return Promise.reject(new Error(err.response?.data?.error || 'Server error'));
  }
);
export default client;
