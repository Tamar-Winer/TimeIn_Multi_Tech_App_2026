
import client from './client';
export const integrationsApi = {
  getStatus:           ()              => client.get('/integrations/status'),

  // repo configurations
  getRepoConfigs:      ()              => client.get('/integrations/repo-configs'),
  addRepoConfig:       (data)          => client.post('/integrations/repo-configs', data),
  deleteRepoConfig:    (id)            => client.delete(`/integrations/repo-configs/${id}`),
  fetchRepo:           (id, data)      => client.post(`/integrations/repo-configs/${id}/fetch`, data),

  // commits
  getCommits:          (params = {})   => client.get('/integrations/commits', { params }),
  saveCommit:          (data)          => client.post('/integrations/commits', data),
  linkCommit:          (id, data)      => client.patch(`/integrations/commits/${id}/link`, data),
  getCommitSuggestions:(id)            => client.get(`/integrations/commits/${id}/suggestions`),

  // analysis
  getGaps:             (params = {})   => client.get('/integrations/gaps', { params }),
};
