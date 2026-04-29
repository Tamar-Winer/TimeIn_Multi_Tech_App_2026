
import client from './client';
export const slackApi = {
  getConfig:  ()                       => client.get('/slack/config'),
  saveConfig: (webhookUrl, enabled)    => client.post('/slack/config', { webhookUrl, enabled }),
  test:       ()                       => client.post('/slack/test'),
  send:       (message)               => client.post('/slack/send', { message }),
};
