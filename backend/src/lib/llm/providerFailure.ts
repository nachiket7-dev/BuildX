/** Provider outages may be retried; invalid requests and configuration errors may not. */
export function providerStatus(error: unknown): number {
 const value=error as {status?:unknown;statusCode?:unknown};
 return Number(value?.status ?? value?.statusCode ?? 0);
}

export function retryAfterMs(error: unknown): number | null {
 const value=error as {headers?:Headers|Record<string,string>;response?:{headers?:Headers|Record<string,string>}};
 const headers=value?.headers ?? value?.response?.headers;
 const raw=headers instanceof Headers ? headers.get('retry-after') : headers?.['retry-after'];
 if(!raw)return null;
 const seconds=Number(raw);
 if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
 const date=Date.parse(raw);
 return Number.isFinite(date)?Math.max(0,date-Date.now()):null;
}

export function isTransientProviderFailure(error: unknown): boolean {
 if(error instanceof ProviderCapacityError)return true;
 const status=providerStatus(error);
 if([408,429].includes(status)||status>=500&&status<=599)return true;
 if(status>=400&&status<=499)return false;
 const value=error as {name?:string;code?:string;message?:string};
 return ['APIConnectionTimeoutError','APIConnectionError'].includes(value?.name||'') ||
  ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN'].includes(value?.code||'') ||
  /timed? out|timeout|rate.?limit|too many requests|resourceexhausted|connection reset|econnreset|eai_again/i.test(value?.message||'');
}

export class ProviderCapacityError extends Error {
 readonly retryAfterMs:number|null;
 constructor(message='AI capacity is temporarily unavailable',retryAfter:number|null=null){
  super(message);this.name='ProviderCapacityError';this.retryAfterMs=retryAfter;
 }
}

export function queueRetryDelayMs(error:unknown,attempt:number):number {
 const explicit=error instanceof ProviderCapacityError?error.retryAfterMs:retryAfterMs(error);
 const exponential=Math.min(15_000*Math.pow(2,Math.max(0,attempt-1)),300_000);
 const jitter=Math.floor(Math.random()*5_000);
 return Math.min(Math.max(explicit??exponential+jitter,15_000),900_000);
}

/** A short local retry avoids a queue round-trip for brief 503s. Long 429s yield
 * the worker and are scheduled in PostgreSQL instead of occupying its slot. */
export async function withProviderRetry<T>(operation:()=>Promise<T>,signal?:AbortSignal):Promise<T> {
 let attempt=0;
 for(;;){
  signal?.throwIfAborted();
  try{return await operation();}
  catch(error){
   const after=retryAfterMs(error);
   const status=providerStatus(error);
   const timeout=(error as {name?:string})?.name==='APIConnectionTimeoutError';
   if(!isTransientProviderFailure(error)||status===429||timeout||++attempt>1||after!==null&&after>5_000)throw error;
   const delay=Math.max(after??0,Math.min(750*Math.pow(2,attempt-1)+Math.floor(Math.random()*250),2_000));
   await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);
    const abort=()=>{clearTimeout(timer);reject(signal?.reason??new Error('Aborted'));};
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
   });
  }
 }
}
