const allowed = new Set(['--live','--free-only','--max-usd','--prices','--output','--limit','--model','--review-model','--skills','--repeat','--suite','--split']);
const flags = new Set(['--live','--free-only']);
function parseOptions(args) {
 const values = {};
 for(let i=0;i<args.length;i++) {
  const key=args[i];
  if(!allowed.has(key) || key in values) throw new Error('Unknown or duplicate option: '+key);
  if(flags.has(key))values[key]=true;
  else {const value=args[++i];if(!value || value.startsWith('--'))throw new Error('Missing value for '+key);values[key]=value;}
 }
 const integer=(key,fallback,max)=>{const value=Number(values[key]??fallback);if(!Number.isInteger(value)||value<1||value>max)throw new Error('Invalid '+key);return value;};
 const skills=values['--skills']||'enabled';
 if(!['enabled','baseline'].includes(skills))throw new Error('Invalid --skills');
 const suite=values['--suite']||'integration';
 const split=values['--split']||'development';
 if(!['integration','application','screening','all'].includes(suite)||!['development','held-out','all'].includes(split))throw new Error('Invalid suite or split');
 const ceiling=Number(values['--max-usd']??0);
 if(!Number.isFinite(ceiling)||ceiling<0)throw new Error('Invalid spend ceiling');
 if(values['--live'] && (!values['--prices'] || (!values['--free-only'] && ceiling<=0)))throw new Error('Live evaluation requires verified --prices and --free-only or a positive --max-usd');
 return {suite,split,live:!!values['--live'],freeOnly:!!values['--free-only'],ceiling,prices:values['--prices'],output:values['--output'],limit:integer('--limit',3,50),repeat:integer('--repeat',1,5),skills,model:values['--model']||'pipeline',reviewModel:values['--review-model']};
}
function reserveCost(prices,model,messages,tools,reserved,options) {
 const rate=prices[model];
 if(!rate||!Number.isFinite(rate.input)||!Number.isFinite(rate.output)||rate.input<0||rate.output<0)throw new Error('Verified prices missing for '+model);
 if(options.freeOnly && (rate.input!==0||rate.output!==0))throw new Error('Free-only policy blocks '+model);
 const maximum=(Buffer.byteLength(JSON.stringify({messages,tools}))*rate.input+6000*rate.output)/1e6;
 if(!Number.isFinite(maximum)||reserved+maximum>options.ceiling)throw new Error('Evaluation cost ceiling reached before provider call');
 return reserved+maximum;
}
module.exports={parseOptions,reserveCost};
