
import client from './client';
export const projectsApi = {
  getAll: ()        => client.get('/projects'),
  create: (data)    => client.post('/projects', data),
  update: (id,data) => client.patch('/projects/' + id, data),
};
