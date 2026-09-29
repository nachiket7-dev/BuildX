import { z } from 'zod';
import { getBlueprintOwnedByUser, getUsageCount, assertWithinUsageLimit } from '../db';
import { BlueprintSchema } from '../types';
import { isPremiumModel, resolveModelId } from '../llm/router';
import { acquireWorkspace } from './store';
import { buildBlueprint } from './blueprint';
import { revision } from './validation';
import type { AgentState } from './engine';
import type { JobHandler } from './worker';

export const specJobSchema=z.object({prompt:z.string().trim().min(1).max(16000),model:z.string().optional()}).strict();
export const queuedSpecHandler:JobHandler=async(job,context)=>{
 const payload=specJobSchema.parse(job.payload);
 const lockLost=new AbortController();
 const signal=AbortSignal.any([context.signal,lockLost.signal]);
 const release=await acquireWorkspace(job.workspace_id,()=>lockLost.abort());
 try {
  const saved=await getBlueprintOwnedByUser(job.workspace_id,job.owner_id);
  if(!saved)throw new Error('Blueprint unavailable');
  const original=saved.parsedBlueprint;
  const sourceRevision=revision({'blueprint.json':saved.blueprint});
  const checkpoint=job.checkpoint as {sourceRevision:string;state?:AgentState;blueprint?:unknown}|null;
  if(checkpoint && checkpoint.sourceRevision!==sourceRevision)throw new Error('Blueprint changed since checkpoint');
  const modelId=isPremiumModel(payload.model)?resolveModelId(payload.model):undefined;
  if(modelId)assertWithinUsageLimit(await getUsageCount(job.owner_id,modelId),modelId,5);
  const blueprint=checkpoint?.blueprint?BlueprintSchema.parse(checkpoint.blueprint):await buildBlueprint(
   job.kind==='regenerate' ? `Regenerate this application specification from its original idea: ${saved.idea}. Preserve the selected stack and existing scope unless improving consistency.` : payload.prompt,
   payload.model,original.stack,{},signal,original,undefined,
   {resume:checkpoint?.state,checkpoint:state=>context.checkpoint({sourceRevision,state})});
  signal.throwIfAborted();
  await context.checkpoint({sourceRevision,blueprint});
  return {result:{id:job.workspace_id,data:blueprint},commit:async client=>{
   const current=await client.query('SELECT blueprint FROM blueprints WHERE id=$1 AND user_id=$2 FOR UPDATE',[job.workspace_id,job.owner_id]);
   if(!current.rows[0] || revision({'blueprint.json':current.rows[0].blueprint})!==sourceRevision)
    throw new Error('Blueprint changed during job; update not applied');
   if(modelId){
    const usage=await client.query(`INSERT INTO model_usage(user_id,model,date,count) VALUES($1,$2,(clock_timestamp() AT TIME ZONE 'UTC')::date,1)
     ON CONFLICT(user_id,model,date) DO UPDATE SET count=model_usage.count+1 WHERE model_usage.count<5 RETURNING count`,[job.owner_id,modelId]);
    if(!usage.rowCount)throw new Error('Daily model limit reached before completion');
   }
   await client.query('UPDATE blueprints SET blueprint=$1 WHERE id=$2 AND user_id=$3',[JSON.stringify(blueprint),job.workspace_id,job.owner_id]);
  }};
 }finally{await release();}
};
