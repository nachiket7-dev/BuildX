import type { LLMMessage } from '../llm/types';
/** Preserve provider-owned assistant envelopes and call IDs. Only old, rereadable
 * repository tool results may be evicted; decisions/checks stay in durable state. */
export function compactRepositoryContext(messages: LLMMessage[], threshold = 100000) {
  const size=()=>Buffer.byteLength(JSON.stringify(messages),'utf8');
  const before=size();
  if(before<=threshold)return {messages,compacted:0,before,after:before};
  const names=new Map<string,string>();
  for(const message of messages)for(const tool of message.tool_calls||[])names.set(tool.id,tool.function.name);
  const copy=messages.slice();let compacted=0;
  for(let i=0;i<Math.max(0,copy.length-12);i++){
    const message=copy[i];
    const name=names.get(message.tool_call_id||'');
    if(message.role!=='tool'||!['read_file','search_code','get_project_context','find_relevant_files'].includes(name||'')||typeof message.content!=='string'||message.content.length<1500)continue;
    copy[i]={...message,content:JSON.stringify({compacted:true,tool:name,note:'Earlier repository output omitted to bound context. Re-run this read/search tool for current source; do not guess omitted content.'})};
    compacted++;
    if(Buffer.byteLength(JSON.stringify(copy),'utf8')<=threshold)break;
  }
  return {messages:copy,compacted,before,after:Buffer.byteLength(JSON.stringify(copy),'utf8')};
}
