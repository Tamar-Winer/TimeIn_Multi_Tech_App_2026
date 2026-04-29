
import client from './client';
export const apiKeysApi = {
  list:   ()                         => client.get('/api-keys'),
  create: (name, userId)             => client.post('/api-keys', { name, userId }),
  toggle: (id, isActive)             => client.patch(`/api-keys/${id}`, { isActive }),
  remove: (id)                       => client.delete(`/api-keys/${id}`),
};
