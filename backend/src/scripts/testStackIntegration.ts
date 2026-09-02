import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { runAgenticBlueprintPipeline } from '../lib/orchestrator';
import { StackSpec } from '../lib/types';

async function testStackPipeline() {
  console.log('=== TEST: Multi-Model Blueprint Pipeline with Custom Tech Stack ===\n');

  const idea = 'AI-powered content scheduling platform for creator teams';
  const customStack: StackSpec = {
    framework: 'next',
    db: 'supabase',
    auth: 'clerk',
  };

  console.log('Idea:', idea);
  console.log('Custom Stack:', customStack);
  console.log('\nDispatching the unified agent pipeline with configured stage fallbacks...');

  const startTime = Date.now();
  const blueprint = await runAgenticBlueprintPipeline(idea, undefined, undefined, customStack);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n✅ Generation completed in ${elapsed}s!`);
  console.log('App Name:', blueprint.appName);
  console.log('Architecture:', JSON.stringify(blueprint.architecture, null, 2));
  console.log(`Schema Tables (${blueprint.schema.length}):`, blueprint.schema.map(t => t.table));
  console.log(`API Endpoints (${blueprint.endpoints.length}):`, blueprint.endpoints.map(e => `${e.method} ${e.path}`));
  console.log(`UI Screens (${blueprint.screens.length}):`, blueprint.screens.map(s => s.name));
  console.log('Archetype:', blueprint.productArchetype);
  console.log('Paradigm:', blueprint.layoutParadigm);
}

testStackPipeline().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
