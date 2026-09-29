import { DurableJobClient } from './durableJobs';
import { getAuthHeaders } from './api';
export const queuedJobsEnabled = import.meta.env.VITE_AGENT_QUEUE_ENABLED === 'true';
export function jobClient(owner: string) {
  const token = getAuthHeaders().Authorization;
  return new DurableJobClient(owner, localStorage, (url, init) => fetch(`${import.meta.env.VITE_API_URL ?? ''}${url}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
  }));
}

/** The token identity scopes recovery storage; the server still verifies ownership. */
export function currentJobClient() {
  const token = getAuthHeaders().Authorization?.replace(/^Bearer /, '');
  if (!token) throw new Error('Please sign in to run this job');
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.userId !== 'string') throw new Error();
    return jobClient(payload.userId);
  } catch { throw new Error('Please sign in again before starting a job'); }
}
