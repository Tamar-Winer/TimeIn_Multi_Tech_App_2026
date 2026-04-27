
import client from './client';
export const usersApi = {
  list:   ()         => client.get('/users'),
  update: (id, data) => client.patch(`/users/${id}`, data),
};
