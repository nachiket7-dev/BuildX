import 'dotenv/config';
import { getAgentPool } from './lib/db';
import { AgentQueue } from './lib/agent/queue';
async function main(){
 if(process.argv.slice(2).some(arg=>!['--apply','--health'].includes(arg)))throw new Error('Use --health or --apply; default is retention dry-run');
 const pool=await getAgentPool();if(!pool)throw new Error('Maintenance requires PostgreSQL');
 try {
  const queue=new AgentQueue(pool);
  if(process.argv.includes('--health')){const health=await queue.health();console.log(JSON.stringify(health));if(!health.workers)process.exitCode=1;return;}
  const days=Number(process.env.AGENT_RETENTION_DAYS??30);const dryRun=!process.argv.includes('--apply');
  console.log(JSON.stringify({dryRun,days,jobs:await queue.retain(days,dryRun)}));
 }finally{await pool.end();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
