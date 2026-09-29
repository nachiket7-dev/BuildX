import { z } from 'zod';
import type { CheckResult } from './sandbox';
import { isWorkspacePath } from './validation';
export const criterionSchema = z.object({
  id:z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
  description:z.string().min(10).max(500),
  project:z.string().refine(value=>value==='.'||isWorkspacePath(value),'Invalid project'),
  kind:z.enum(['test','build','typecheck']),
}).strict();
export type AcceptanceCriterion = z.infer<typeof criterionSchema>;
export function addCriteria(current: AcceptanceCriterion[], input: unknown): AcceptanceCriterion[] {
  const incoming=z.array(criterionSchema).min(1).max(12).parse(input);
  const result=new Map(current.map(item=>[item.id,item]));
  for(const criterion of incoming){
    const previous=result.get(criterion.id);
    if(previous && JSON.stringify(previous)!==JSON.stringify(criterion))throw new Error('Existing criteria cannot be weakened or replaced');
    result.set(criterion.id,criterion);
  }
  if(result.size>12)throw new Error('At most 12 acceptance criteria');
  return [...result.values()];
}
export function evidenceReport(criteria: AcceptanceCriterion[],checks: CheckResult[],revision: string) {
  return criteria.map(criterion=>{
    const matching=checks.filter(check=>check.revision===revision&&(check.project||'.')===criterion.project&&check.kind===criterion.kind);
    const check=matching.at(-1);
    return {...criterion,status:check?.status||'missing',revision,
      note:'Status describes execution of the declared check, not proof that it fully tests this requirement.'};
  });
}
/** Retrieval is lexical and transparent, never an instruction channel. */
export function findRelevantFiles(files: Record<string,string>,query: string) {
  const terms=[...new Set(query.toLowerCase().match(/[a-z0-9_]{3,}/g)||[])].slice(0,16);
  if(!terms.length)return [];
  return Object.entries(files).filter(([path])=>!/(^|\/)(\.env(?:\.|$)|node_modules\/|\.git\/)/.test(path))
    .map(([path,content])=>({path,score:terms.reduce((score,term)=>score+(path.toLowerCase().includes(term)?5:0)+(content.slice(0,100000).toLowerCase().includes(term)?1:0),0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,20);
}
