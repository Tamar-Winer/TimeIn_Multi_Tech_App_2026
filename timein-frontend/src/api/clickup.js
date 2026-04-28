
import client from './client';
export const clickupApi = {
  getConfig:           ()              => client.get('/clickup/config'),
  saveConfig:          (data)          => client.post('/clickup/config', data),
  deleteConfig:        ()              => client.delete('/clickup/config'),
  getTeams:            ()              => client.get('/clickup/teams'),
  getSpaces:           (teamId)        => client.get(`/clickup/spaces/${teamId}`),
  getLists:            (spaceId)       => client.get(`/clickup/lists/${spaceId}`),
  syncSpace:           (spaceId)       => client.post(`/clickup/sync/space/${spaceId}`),
  syncList:            (listId)        => client.post(`/clickup/sync/list/${listId}`),
  getTasks:            (params = {})   => client.get('/clickup/tasks', { params }),
  getStatus:           ()              => client.get('/clickup/status'),
  getMappingUsers:     ()              => client.get('/clickup/mapping/users'),
  saveMappingUser:     (data)          => client.post('/clickup/mapping/users', data),
  getMappingProjects:  ()              => client.get('/clickup/mapping/projects'),
  saveMappingProject:  (data)          => client.post('/clickup/mapping/projects', data),
};
