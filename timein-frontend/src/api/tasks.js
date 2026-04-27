
import client from './client';
export const tasksApi = {
  getAll: (params={}) => client.get('/tasks', { params }),
  create: (data)      => client.post('/tasks', data),
  update: (id,data)   => client.patch('/tasks/' + id, data),
  delete: (id)        => client.delete('/tasks/' + id),
};
