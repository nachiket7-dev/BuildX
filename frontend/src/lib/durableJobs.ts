/** Browser recovery records contain requests/IDs only, never credentials or checkpoints. */
export interface PendingJob {
  key: string;
  endpoint: string;
  body: Record<string, unknown>;
  jobId?: string;
}
export interface JobSnapshot<T> {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  attempt: number;
  nextAttemptAt?: string | null;
  result?: T;
  error?: string;
}
export function jobProgressLabel(job: JobSnapshot<unknown>): string {
  if (job.status === 'queued' && job.nextAttemptAt) {
    const at = Date.parse(job.nextAttemptAt);
    return Number.isFinite(at) ? `Waiting for AI capacity · retry at ${new Date(at).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}` : 'Waiting for AI capacity';
  }
  return job.status === 'queued' ? 'Queued — waiting for a worker' : `Worker ${job.status} · attempt ${job.attempt}`;
}
class JobRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export class DurableJobClient {
  constructor(
    private owner: string,
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
    private request: (url: string, init?: RequestInit) => Promise<Response>,
    private interval = 2000,
  ) {}
  private slot(scope: string) { return `buildx.job:${this.owner}:${scope}`; }
  pending(scope: string): PendingJob | null {
    const text = this.storage.getItem(this.slot(scope));
    if (!text) return null;
    try {
      const value = JSON.parse(text);
      if (typeof value.key !== 'string' || typeof value.endpoint !== 'string' || !value.body || typeof value.body !== 'object' ||
          !/^\/api\/agent\/(blueprint-jobs|[a-zA-Z0-9_-]+\/(?:jobs|spec-jobs))$/.test(value.endpoint) ||
          (value.jobId !== undefined && !/^[\da-f-]{36}$/i.test(value.jobId))) throw new Error();
      return value;
    } catch { throw new Error('Saved job recovery data is invalid. Clear this browser’s saved job record before retrying.'); }
  }
  begin(scope: string, endpoint: string, body: Record<string, unknown>): PendingJob {
    const pending = this.pending(scope);
    if (pending) {
      if (pending.endpoint !== endpoint || JSON.stringify(pending.body) !== JSON.stringify(body))
        throw new Error('Another request is saved for recovery. Resume or stop it before starting a different request.');
      return pending;
    }
    const record = { key: crypto.randomUUID(), endpoint, body: JSON.parse(JSON.stringify(body)) };
    // Fail before submission if recovery cannot be persisted.
    this.storage.setItem(this.slot(scope), JSON.stringify(record));
    return record;
  }
  async attach(scope: string, record: PendingJob) {
    const pending = this.pending(scope);
    if (pending && !pending.jobId) await this.submit(scope, pending);
    if (pending && pending.jobId !== record.jobId) throw new Error('Another request is saved for recovery. Stop or recover it first.');
    this.storage.setItem(this.slot(scope), JSON.stringify(record));
    return record;
  }
  forget(scope: string, record: PendingJob) {
    if (this.pending(scope)?.key === record.key) this.storage.removeItem(this.slot(scope));
  }
  acknowledge(scope: string, jobId: string, requestKey?: string) {
    const pending = this.pending(scope);
    if (pending && (pending.jobId === jobId || (requestKey && pending.key === requestKey))) this.forget(scope, pending);
  }
  private async json(url: string, init?: RequestInit) {
    const response = await this.request(url, init);
    const data = await response.json();
    if (!response.ok) throw new JobRequestError(data.error || `Job request failed (${response.status})`, response.status);
    return data;
  }
  async submit(scope: string, record: PendingJob, signal?: AbortSignal): Promise<string> {
    if (record.jobId) return record.jobId;
    let data;
    try {
      data = await this.json(record.endpoint, { method: 'POST', body: JSON.stringify({ ...record.body, key: record.key }), signal });
    } catch (error) {
      // A validation rejection cannot have queued work. Ambiguous network/server
      // failures must retain the same key for recovery, never silently retry anew.
      if (error instanceof JobRequestError && error.status === 400) this.forget(scope, record);
      throw error;
    }
    if (typeof data.jobId !== 'string' || !/^[\da-f-]{36}$/i.test(data.jobId)) throw new Error('Server returned an invalid job ID');
    record.jobId = data.jobId;
    if (this.pending(scope)?.key === record.key) this.storage.setItem(this.slot(scope), JSON.stringify(record));
    return data.jobId;
  }
  async watch<T>(scope: string, record: PendingJob, signal: AbortSignal, progress?: (job: JobSnapshot<T>) => void): Promise<T> {
    const id = await this.submit(scope, record, signal);
    let lastStatus = '';
    for (;;) {
      signal.throwIfAborted();
      let job:JobSnapshot<T>;
      try { job=await this.json(`${record.endpoint}/${id}`, { signal }) as JobSnapshot<T>; }
      catch(error){if(error instanceof JobRequestError && error.status===410)this.forget(scope,record);throw error;}
      signal.throwIfAborted();
      const status = `${job.status}:${job.attempt}:${job.nextAttemptAt || ''}`;
      if (status !== lastStatus) progress?.(job);
      lastStatus = status;
      if (job.status === 'completed') {
        if (!job.result) throw new Error('Completed job has no result');
        return job.result; // Consumer acknowledges after applying the result.
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        this.forget(scope, record);
        throw new Error(job.error || `Job ${job.status}`);
      }
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, this.interval);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
  }
  async stop(scope: string, record: PendingJob) {
    // An interrupted POST may already have created the job. Resolve the same key
    // before cancelling; never discard an ambiguous request or create a new key.
    const id = await this.submit(scope, record);
    const result = await this.json(`${record.endpoint}/${id}/cancel`, { method: 'POST', body: '{}' });
    if (!result.cancelled) {
      const job = await this.json(`${record.endpoint}/${id}`);
      if (job.status === 'completed') throw new Error('This job already completed. Resume it to retrieve the result.');
      if (job.status !== 'cancelled' && job.status !== 'failed') throw new Error('Cancellation was not acknowledged. Try Stop again.');
    }
    this.forget(scope, record);
  }
}
