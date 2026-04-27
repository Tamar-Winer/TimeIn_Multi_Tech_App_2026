
import client from './client';
export const usersApi = {
  list:   ()         => client.get('/users'),
  create: (data)     => client.post('/users', data),
  update: (id, data) => client.patch(`/users/${id}`, data),
};
