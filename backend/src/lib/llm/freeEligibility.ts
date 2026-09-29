import { CompletionOptions } from './types';
import { ProviderCapacityError } from './providerFailure';

/** Fail closed: a stale marketing page is not permission to use a paid endpoint. */
export async function verifyFreeOpenRouter(model: string, key: string, options?: CompletionOptions,
  request: typeof fetch = fetch): Promise<void> {
  if (!model.endsWith(':free')) throw new Error('Free-only policy requires an explicit OpenRouter :free model');
  const signal = options?.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
  const fetchVerified: typeof fetch = async (input, init) => {
    try { return await request(input, init); }
    catch (error) {
      options?.signal?.throwIfAborted();
      throw new ProviderCapacityError('Free-model eligibility service is temporarily unavailable');
    }
  };
  const catalogResponse = await fetchVerified('https://openrouter.ai/api/v1/models', { signal });
  if (!catalogResponse.ok) throw new ProviderCapacityError('Unable to verify the free-model catalog');
  const catalog = await catalogResponse.json() as { data?: Array<{id: string; pricing?: Record<string, unknown>; supported_parameters?: string[]}> };
  const entry = catalog.data?.find(item => item.id === model);
  if (!entry?.pricing || entry.pricing.prompt === undefined || entry.pricing.completion === undefined ||
      Object.values(entry.pricing).some(price => price === null || price === '' || !Number.isFinite(Number(price)) || Number(price) !== 0))
    throw new Error('Model is absent from the current zero-priced catalog');
  if (options?.tools?.length && !entry.supported_parameters?.includes('tools'))
    throw new Error('Selected free model does not advertise tool support');
  if (options?.responseFormat && !entry.supported_parameters?.includes('response_format'))
    throw new Error('Selected free model does not advertise JSON output support');
  const quotaResponse = await fetchVerified('https://openrouter.ai/api/v1/key', {
    signal, headers: { Authorization: `Bearer ${key}` },
  });
  if (!quotaResponse.ok) {
    if (quotaResponse.status === 429 || quotaResponse.status >= 500)
      throw new ProviderCapacityError('OpenRouter free quota service is temporarily unavailable');
    throw new Error('Unable to verify OpenRouter free quota');
  }
  const quota = await quotaResponse.json() as {data?: {free_model_daily_requests?: {remaining?: number}}};
  const remaining = quota.data?.free_model_daily_requests?.remaining;
  if (!Number.isFinite(remaining)) throw new Error('OpenRouter free quota is unavailable');
  if (remaining! < 1) throw new ProviderCapacityError('OpenRouter daily free quota is exhausted');
}
