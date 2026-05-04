
import client from './client';

export const teamsApi = {
  list:          ()                    => client.get('/teams'),
  create:        (data)                => client.post('/teams', data),
  update:        (id, data)            => client.patch(`/teams/${id}`, data),
  remove:        (id)                  => client.delete(`/teams/${id}`),
  listMembers:   (id)                  => client.get(`/teams/${id}/members`),
  addMember:     (id, userId)          => client.post(`/teams/${id}/members`, { userId }),
  removeMember:  (id, userId)          => client.delete(`/teams/${id}/members/${userId}`),
  listProjects:  (id)                  => client.get(`/teams/${id}/projects`),
  addProject:    (id, projectId)       => client.post(`/teams/${id}/projects`, { projectId }),
  removeProject: (id, projectId)       => client.delete(`/teams/${id}/projects/${projectId}`),
};
