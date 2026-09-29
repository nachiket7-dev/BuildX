import type { Blueprint } from './types';
import { currentJobClient } from './jobClient';
import { jobProgressLabel } from './durableJobs';

export async function runSpecJob(id:string,kind:'refine'|'regenerate',prompt:string,model?:string,signal?:AbortSignal,onProgress?:(status:string)=>void) {
 const client=currentJobClient();const scope=`spec:${id}`;
 const record=client.begin(scope,`/api/agent/${id}/spec-jobs`,{kind,prompt,...(model?{model}:{})});
 const result=await client.watch<{id:string;data:Blueprint}>(scope,record,signal??new AbortController().signal,job=>onProgress?.(jobProgressLabel(job)));
 client.forget(scope,record);
 return result.data;
}
export async function stopSpecJob(id:string) {
 const client=currentJobClient();const scope=`spec:${id}`;const record=client.pending(scope);
 if(record)await client.stop(scope,record);
}
