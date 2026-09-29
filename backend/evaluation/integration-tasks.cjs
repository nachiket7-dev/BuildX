// Small multi-file integration fixtures. Reference repairs are evaluator-only.
const pkg='{"type":"module","scripts":{"test":"node --test acceptance.test.mjs"}}';
const task=(id,prompt,files,acceptance,reference,split='development')=>({id,category:'integration',split,prompt,files:{'package.json':pkg,...files},acceptance:"import assert from 'node:assert/strict';\n"+acceptance,reference});
module.exports=[
 task('integration-owner-update','Repair task updates: derive owner from session, prevent cross-user edits and protect id/owner fields. Preserve title updates.',{
  'repository.mjs':'export const rows=[{id:"1",owner:"alice",title:"old"}]; export function update(id,patch){const row=rows.find(r=>r.id===id);if(row)Object.assign(row,patch);return row;}',
  'service.mjs':'import {update} from "./repository.mjs"; export function edit(session,id,patch){return update(id,patch);}',
 },`import {edit} from './service.mjs';import {rows} from './repository.mjs';
assert.throws(()=>edit(null,'1',{title:'x'}));
assert.equal(edit({userId:'bob'},'1',{title:'stolen'}),undefined);
assert.equal(rows[0].title,'old');
assert.equal(edit({userId:'alice'},'1',{title:'new',id:'2',owner:'bob'}).title,'new');
assert.deepEqual(rows[0],{id:'1',owner:'alice',title:'new'});`,{
  'repository.mjs':'export const rows=[{id:"1",owner:"alice",title:"old"}];export function update(id,owner,patch){const row=rows.find(r=>r.id===id&&r.owner===owner);if(row&&typeof patch.title==="string")row.title=patch.title;return row;}',
  'service.mjs':'import {update} from "./repository.mjs";export function edit(session,id,patch){if(!session?.userId)throw new Error("unauthorized");return update(id,session.userId,patch);}',
 }),
 task('integration-stale-save','Make revision-based saves atomic within this in-memory adapter: stale writes must reject without overwriting state; successful writes increment revision.',{
  'store.mjs':'export const state={content:"original",revision:1};export async function save(content,expected){await Promise.resolve();state.content=content;state.revision++;return {...state};}',
  'service.mjs':'export {save} from "./store.mjs";',
 },`import {save} from './service.mjs';import {state} from './store.mjs';
const results=await Promise.allSettled([save('one',1),save('two',1)]);
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
assert.equal(state.revision,2);const before={...state};
await assert.rejects(save('stale',1));assert.deepEqual(state,before);`,{
  'store.mjs':'export const state={content:"original",revision:1};export async function save(content,expected){if(state.revision!==expected)throw new Error("conflict");state.content=content;state.revision++;return {...state};}',
 }),
 task('integration-event-replay','Repair replay consumption: deduplicate by sequence, retain order across repeated batches, and advance cursor only after handler succeeds so a failed event can retry.',{
  'events.mjs':'export function consume(state,events,handle){for(const event of events){state.cursor=event.sequence;handle(event);state.values.push(event.value);}}',
  'state.mjs':'export const create=()=>({cursor:0,values:[]});',
 },`import {consume} from './events.mjs';import {create} from './state.mjs';const s=create();const events=[{sequence:1,value:'a'},{sequence:2,value:'b'}];
consume(s,events,()=>{});consume(s,events,()=>{});assert.deepEqual(s.values,['a','b']);
assert.throws(()=>consume(s,[{sequence:3,value:'c'}],()=>{throw new Error('retry')}));assert.equal(s.cursor,2);
consume(s,[{sequence:3,value:'c'}],()=>{});assert.deepEqual(s.values,['a','b','c']);`,{
  'events.mjs':'export function consume(state,events,handle){for(const event of events){if(event.sequence<=state.cursor)continue;handle(event);state.values.push(event.value);state.cursor=event.sequence;}}',
 }),
 task('integration-cancel-fallback','Preserve cancellation: if a provider aborts the supplied signal, propagate that failure without trying fallback. Ordinary provider failures may use fallback.',{
  'router.mjs':'export async function run(primary,fallback,signal){try{return await primary(signal)}catch{return fallback(signal)}}',
  'consumer.mjs':'export {run} from "./router.mjs";',
 },`import {run} from './consumer.mjs';let calls=0;const c=new AbortController();
await assert.rejects(run(async()=>{c.abort();throw new Error('aborted')},async()=>{calls++;return 'bad'},c.signal));assert.equal(calls,0);
assert.equal(await run(async()=>{throw new Error('offline')},async()=>{calls++;return 'ok'},new AbortController().signal),'ok');assert.equal(calls,1);`,{
  'router.mjs':'export async function run(primary,fallback,signal){signal.throwIfAborted();try{return await primary(signal)}catch(error){signal.throwIfAborted();return fallback(signal)}}',
 },'held-out'),
 task('integration-config-validation','Validate the configured port before starting: default absent port to 3001, allow integers 1..65535, reject invalid values; preserve host configuration.',{
  'config.mjs':'export function config(env){return {port:Number(env.PORT)||3001,host:env.HOST||"127.0.0.1"}}',
  'server.mjs':'import {config} from "./config.mjs";export function start(env,listen){const c=config(env);return listen(c.port,c.host)}',
 },`import {start} from './server.mjs';const listen=(...args)=>args;
assert.deepEqual(start({},listen),[3001,'127.0.0.1']);assert.deepEqual(start({PORT:'8080',HOST:'localhost'},listen),[8080,'localhost']);
for(const PORT of ['0','-1','65536','3.2','x',''])assert.throws(()=>start({PORT},listen));`,{
  'config.mjs':'export function config(env){const port=env.PORT===undefined?3001:Number(env.PORT);if(!Number.isInteger(port)||port<1||port>65535)throw new Error("invalid port");return {port,host:env.HOST||"127.0.0.1"}}',
 },'held-out'),
 task('integration-check-provenance','Only report verified when each changed project has a passed check at the final revision. Old passes, failures, unavailable checks and absent projects must not count.',{
  'verification.mjs':'export function verified(projects,revision,checks){return checks.some(c=>c.status==="passed")}',
  'report.mjs':'import {verified} from "./verification.mjs";export const report=(p,r,c)=>({verified:verified(p,r,c)});',
 },`import {report} from './report.mjs';const p=['backend','frontend'];const c=(project,status,revision='new')=>({project,status,revision});
assert.equal(report(p,'new',[c('backend','passed')]).verified,false);
assert.equal(report(p,'new',[c('backend','passed'),c('frontend','passed','old')]).verified,false);
assert.equal(report(p,'new',[c('backend','passed'),c('frontend','unavailable')]).verified,false);
assert.equal(report(p,'new',[c('backend','passed'),c('frontend','passed')]).verified,true);
assert.equal(report(p,'new',[c('backend','passed'),c('frontend','passed'),c('frontend','failed')]).verified,false);`,{
  'verification.mjs':'export function verified(projects,revision,checks){return projects.length>0&&projects.every(project=>{const matching=checks.filter(c=>c.project===project&&c.revision===revision);return matching.length>0&&matching.every(c=>c.status==="passed")})}',
 },'held-out'),
];
