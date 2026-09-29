import { getBlueprintOwnedByUser, getBlueprintFiles, getChatMessages } from '../db';
import { acquireWorkspace } from './store';
import { runEngineeringAgent, AgentState } from './engine';
import { revision } from './validation';
import { generateMonorepoFiles } from '../scaffold';
import type { JobHandler } from './worker';

/** Candidate-only workspace execution. Queue completion never applies code to the
 * user's workspace; acceptance remains a separate compare-and-swap operation. */
export const queuedWorkspaceHandler:JobHandler=async(job,context)=>{
 const controller=new AbortController();
 const signal=AbortSignal.any([context.signal,controller.signal]);
 const release=await acquireWorkspace(job.workspace_id,()=>controller.abort(new Error('Workspace lock lost')));
 try {
  const blueprint=await getBlueprintOwnedByUser(job.workspace_id,job.owner_id);
  if(!blueprint)throw new Error('Workspace unavailable');
  const saved=await getBlueprintFiles(job.workspace_id);
  const sourceRevision=revision(Object.fromEntries(saved.map(file=>[file.path,file.content])));
  const payload=job.payload as {prompt:string;model?:string;activeFilePath?:string;previewErrors?:unknown};
  const checkpoint=job.checkpoint as {sourceRevision:string;state:AgentState}|null;
  if(checkpoint && checkpoint.sourceRevision!==sourceRevision)throw new Error('Workspace changed since checkpoint');
  const initial=saved.length?saved:job.kind==='codegen'?Object.entries(generateMonorepoFiles(blueprint.parsedBlueprint)).map(([path,content])=>({path,content})):[];
  if(!initial.length)throw new Error('Initialize the workspace before starting a chat job');
  const result=await runEngineeringAgent(payload.prompt,initial,{
   taskKind: job.kind === 'codegen' ? 'codegen' : 'edit',
   model:payload.model,signal,activeFilePath:payload.activeFilePath,previewErrors:payload.previewErrors,history:await getChatMessages(job.workspace_id,job.owner_id),schema:blueprint.parsedBlueprint,resume:checkpoint?.state,
   checkpoint:state=>context.checkpoint({sourceRevision,state}),
  },()=>{});
  signal.throwIfAborted();
  // A fresh codegen candidate includes the scaffold, not just model edits to it.
  if (!saved.length) {
   const candidate = {...Object.fromEntries(initial.map(file=>[file.path,file.content])),
    ...Object.fromEntries(result.modifiedFiles.map(file=>[file.path,file.content]))};
   result.modifiedFiles=Object.entries(candidate).map(([path,content])=>({path,content}));
   result.stagedDiffs=Object.fromEntries(Object.entries(candidate).map(([path,modified])=>[path,{original:'',modified}]));
   result.revision=sourceRevision;
  }
  return {result,commit:async client=>{
   // All existing workspace writes lock this blueprint row before changing files.
   const owned=await client.query('SELECT id FROM blueprints WHERE id=$1 AND user_id=$2 FOR UPDATE',[job.workspace_id,job.owner_id]);
   if(!owned.rowCount)throw new Error('Workspace unavailable at completion');
   const current=await client.query('SELECT file_path,content FROM blueprint_files WHERE blueprint_id=$1',[job.workspace_id]);
   if(revision(Object.fromEntries(current.rows.map(row=>[row.file_path,row.content])))!==sourceRevision)throw new Error('Workspace changed during job; candidate not finalized');
   await client.query('INSERT INTO chat_messages(blueprint_id,user_id,role,content) VALUES($1,$2,$3,$4),($1,$2,$5,$6)',
    [job.workspace_id,job.owner_id,'user',payload.prompt,'assistant',result.message]);
  }};
 }finally{await release();}
};
