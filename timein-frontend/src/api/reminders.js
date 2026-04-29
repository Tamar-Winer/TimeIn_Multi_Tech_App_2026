
import client from './client';
export const remindersApi = {
  getConfig:         ()     => client.get('/reminders/config'),
  saveConfig:        (data) => client.post('/reminders/config', data),
  missingToday:      ()     => client.get('/reminders/missing-today'),
  trigger:           ()     => client.post('/reminders/trigger'),
  getRetroConfig:    ()     => client.get('/reminders/retroactive-config'),
  saveRetroConfig:   (data) => client.post('/reminders/retroactive-config', data),
};
