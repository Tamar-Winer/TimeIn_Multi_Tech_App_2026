
import client from './client';
export const integrationsApi = {
  getCommits: (params={}) => client.get('/integrations/commits', { params }),
  saveCommit: (data)      => client.post('/integrations/commits', data),
  getStatus:  ()          => client.get('/integrations/status'),
};
