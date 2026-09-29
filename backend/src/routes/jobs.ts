import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { specJobSchema } from '../lib/agent/queued-spec';
import { BlueprintRequestSchema } from '../lib/types';
import { requireAuth } from '../lib/auth';
import { getAgentPool, getBlueprintOwnedByUser } from '../lib/db';
import { AgentQueue } from '../lib/agent/queue';
import { resolveModelKey } from '../lib/llm/router';

const router=Router();
const requestSchema=z.object({key:z.string().min(1).max(200),kind:z.enum(['chat','repair','codegen']),prompt:z.string().trim().min(1).max(16000),model:z.string().optional(),activeFilePath:z.string().max(500).optional(),previewErrors:z.array(z.object({message:z.string().max(10000),path:z.string().max(500).optional(),title:z.string().max(500).optional(),line:z.number().optional(),column:z.number().optional()})).max(5).optional()}).strict();
router.use(requireAuth);
router.use(async(_req,res,next)=>{
 if(process.env.AGENT_QUEUE_ENABLED!=='true'){res.status(503).json({error:'Queued execution is not enabled'});return;}
 next();
});
async function queue(){
 const pool=await getAgentPool();
 if(!pool)throw Object.assign(new Error('Queued execution requires PostgreSQL'),{status:503});
 const ready=await pool.query("SELECT to_regclass('public.agent_jobs') AS name");
 if(!ready.rows[0].name)throw Object.assign(new Error('Start the queue worker before submitting jobs'),{status:503});
 return new AgentQueue(pool);
}
router.get('/queue-health',async(_req,res,next)=>{
 try{const status=await(await queue()).health();res.status(status.workers>0?200:503).json({ready:status.workers>0});}catch(error){next(error);}
});
const blueprintRequest = BlueprintRequestSchema.extend({key:z.string().min(1).max(200)}).strict();
const blueprintLimiter=rateLimit({windowMs:60_000,max:10,standardHeaders:true,legacyHeaders:false});
router.post('/blueprint-jobs',blueprintLimiter,async(req,res,next)=>{
 try {
  const input=blueprintRequest.safeParse(req.body);
  if(!input.success){res.status(400).json({error:'Invalid blueprint job request'});return;}
  const {key,...payload}=input.data;
  try{resolveModelKey(payload.model);}catch{res.status(400).json({error:'Unknown model'});return;}
  const workspace='new:'+createHash('sha256').update(JSON.stringify([req.user!.userId,key])).digest('hex');
  const job=await (await queue()).enqueue({owner:req.user!.userId,workspace,key,kind:'blueprint',payload});
  res.status(202).json({jobId:job.id,status:job.status});
 }catch(error:any){if(/Idempotency/.test(error.message)){res.status(409).json({error:error.message});return;}next(error);}
});
router.get('/blueprint-jobs/:job',async(req,res,next)=>{
 try {
  const job=await (await queue()).get(req.params.job,req.user!.userId);
  if(!job||job.kind!=='blueprint'){res.status(404).json({error:'Job not found'});return;}
  if(job.archived_at){res.status(410).json({error:'Job artifacts expired under the retention policy. Saved project files are unchanged.'});return;}
  res.json({id:job.id,requestKey:job.request_key,status:job.status,attempt:job.attempt,nextAttemptAt:job.next_attempt_at,result:job.result,error:job.error});
 }catch(error){next(error);}
});
router.post('/blueprint-jobs/:job/cancel',async(req,res,next)=>{
 try {
  const store=await queue();const job=await store.get(req.params.job,req.user!.userId);
  if(!job||job.kind!=='blueprint'){res.status(404).json({error:'Job not found'});return;}
  res.json({cancelled:await store.cancel(job.id,req.user!.userId)});
 }catch(error){next(error);}
});
router.post('/:workspace/spec-jobs',blueprintLimiter,async(req,res,next)=>{
 try{
  const input=specJobSchema.extend({key:z.string().min(1).max(200),kind:z.enum(['refine','regenerate'])}).safeParse(req.body);
  if(!input.success){res.status(400).json({error:'Invalid specification request'});return;}
  const {key,kind,...payload}=input.data;
  try{resolveModelKey(payload.model);}catch{res.status(400).json({error:'Unknown model'});return;}
  if(!await getBlueprintOwnedByUser(req.params.workspace,req.user!.userId)){res.status(404).json({error:'Blueprint not found'});return;}
  const job=await(await queue()).enqueue({owner:req.user!.userId,workspace:req.params.workspace,key,kind,payload});
  res.status(202).json({jobId:job.id,status:job.status});
 }catch(error:any){if(/Idempotency|already owns/.test(error.message)){res.status(409).json({error:error.message});return;}next(error);}
});
router.post('/:workspace/jobs',async(req,res,next)=>{
 try {
  const input=requestSchema.safeParse(req.body);
  if(!input.success){res.status(400).json({error:'Invalid job request'});return;}
  const {key,kind,prompt,model,activeFilePath,previewErrors}=input.data;
  if(model && model!=='pipeline'){try{resolveModelKey(model);}catch{res.status(400).json({error:'Unknown model'});return;}}
  if(!await getBlueprintOwnedByUser(req.params.workspace,req.user!.userId)){res.status(404).json({error:'Workspace not found'});return;}
  const store=await queue();
  const job=await store.enqueue({key,kind,owner:req.user!.userId,workspace:req.params.workspace,payload:{prompt,model,activeFilePath,previewErrors}});
  res.status(202).json({jobId:job.id,status:job.status});
 }catch(error:any){if(/Idempotency|already owns/.test(error.message)){res.status(409).json({error:error.message});return;}next(error);}
});
router.get('/:workspace/jobs',async(req,res,next)=>{
 try {
  if(!await getBlueprintOwnedByUser(req.params.workspace,req.user!.userId)){res.status(404).json({error:'Workspace not found'});return;}
  res.json({runs:await (await queue()).list(req.params.workspace,req.user!.userId)});
 }catch(error){next(error);}
});
router.get(['/:workspace/jobs/:job','/:workspace/spec-jobs/:job'],async(req,res,next)=>{
 try {
  const job=await (await queue()).get(req.params.job,req.user!.userId);
  if(!job||job.workspace_id!==req.params.workspace||!await getBlueprintOwnedByUser(req.params.workspace,req.user!.userId)){res.status(404).json({error:'Job not found'});return;}
  if(job.archived_at){res.status(410).json({error:'Job artifacts expired under the retention policy. Saved project files are unchanged.'});return;}
  res.json({id:job.id,requestKey:job.request_key,status:job.status,attempt:job.attempt,nextAttemptAt:job.next_attempt_at,result:job.result,error:job.error});
 }catch(error){next(error);}
});
router.post(['/:workspace/jobs/:job/cancel','/:workspace/spec-jobs/:job/cancel'],async(req,res,next)=>{
 try {
  const store=await queue();const job=await store.get(req.params.job,req.user!.userId);
  if(!job||job.workspace_id!==req.params.workspace||!await getBlueprintOwnedByUser(req.params.workspace,req.user!.userId)){res.status(404).json({error:'Job not found'});return;}
  res.json({cancelled:await store.cancel(job.id,req.user!.userId)});
 }catch(error){next(error);}
});
export default router;
