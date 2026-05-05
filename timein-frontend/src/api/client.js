
import axios from 'axios';
const baseURL = process.env.REACT_APP_API_URL || '/api';
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
