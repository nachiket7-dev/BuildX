import test from 'node:test';
import assert from 'node:assert/strict';
import { applySearchReplaceStrict, parseDiffBlocks } from '../lib/codegen/diffParser';
import { isPlausibleSourceCode } from '../lib/codegen/skeletonizer';
import { generateMonorepoFiles } from '../lib/scaffold';
import {
  completeWithPipelineFallback,
  isModelCoolingDown,
  PartialPipelineStreamError,
  PIPELINE_ROUTES,
  resetAllCooldowns,
  streamWithPipelineFallback,
  SUBAGENT_TIERS,
} from '../lib/llm/router';
import type { LLMProvider } from '../lib/llm/types';
import type { Blueprint } from '../lib/types';

test('diff parser applies a complete search/replace block', () => {
  const source = 'const value = 1;\n';
  const diff = '<<<<<<< SEARCH\nconst value = 1;\n=======\nconst value = 2;\n>>>>>>> REPLACE';
  assert.equal(applySearchReplaceStrict(source, diff), 'const value = 2;\n');
  assert.notEqual(parseDiffBlocks(diff), 'NO_CHANGE');
});

test('source plausibility rejects prose and accepts TypeScript', () => {
  assert.equal(isPlausibleSourceCode('Here is the requested implementation.', 'App.tsx'), false);
  assert.equal(isPlausibleSourceCode('export const answer: number = 42;', 'answer.ts'), true);
});

test('generated scaffold contains executable route and page implementations', () => {
  const blueprint = {
    appName: 'Smoke App',
    description: 'A generated smoke test application',
    targetUsers: 'Testers',
    complexity: 'Low',
    features: { authentication: [], core: [], admin: [], optional: [] },
    schema: [{ table: 'items', columns: [{ name: 'id', type: 'UUID' }] }],
    endpoints: [
      { method: 'GET', path: '/api/items', description: 'List items', auth: false },
      { method: 'POST', path: '/api/items', description: 'Create item', auth: true },
    ],
    screens: [{ name: 'Items', icon: '•', components: 'table and form' }],
    architecture: {
      frontend: 'React + Vite',
      backend: 'Express + Node.js',
      database: 'PostgreSQL',
      auth: 'JWT',
      hosting: 'Railway',
      flow: 'React to API',
    },
    code: { frontend: '', backend: '', sql: '' },
    effort: { time: '1 week', complexity: 'Low', cost: '0', team: '1' },
  } as Blueprint;

  const files = generateMonorepoFiles(blueprint);
  assert.match(files['backend/src/routes/items.ts'], /records\.push/);
  assert.doesNotMatch(files['backend/src/routes/items.ts'], /TODO/);
  assert.doesNotMatch(files['frontend/src/pages/ItemsPage.tsx'], /TODO/);
});

test('generated scaffold keeps Express, Fastify, and Next.js variants coherent', () => {
  const base = {
    appName: 'Variant Smoke',
    description: 'Generated variant test',
    targetUsers: 'Testers',
    complexity: 'Low',
    features: { authentication: [], core: [], admin: [], optional: [] },
    schema: [{ table: 'items', columns: [{ name: 'id', type: 'UUID' }] }],
    endpoints: [{ method: 'GET', path: '/api/items', description: 'List items', auth: false }],
    screens: [{ name: 'Items', icon: '•', components: 'table' }],
    architecture: {
      frontend: 'React + Vite',
      backend: 'Express + Node.js',
      database: 'PostgreSQL',
      auth: 'JWT',
      hosting: 'Railway',
      flow: 'React to API',
    },
    code: { frontend: '', backend: '', sql: '' },
    effort: { time: '1 week', complexity: 'Low', cost: '0', team: '1' },
  } as Blueprint;

  const express = generateMonorepoFiles(base);
  assert.match(express['backend/src/app.ts'], /import express/);
  assert.match(express['backend/src/routes/items.ts'], /from 'express'/);

  const fastify = generateMonorepoFiles({
    ...base,
    architecture: { ...base.architecture, backend: 'Fastify + Node.js' },
  });
  assert.match(fastify['backend/src/app.ts'], /import Fastify/);
  assert.match(fastify['backend/src/routes/items.ts'], /from 'fastify'/);
  assert.doesNotMatch(fastify['backend/src/routes/items.ts'], /from 'express'/);

  const next = generateMonorepoFiles({
    ...base,
    architecture: { ...base.architecture, frontend: 'Next.js 14' },
  });
  assert.ok(next['frontend/src/app/page.tsx']);
  assert.ok(next['frontend/src/app/layout.tsx']);
  assert.equal(next['frontend/index.html'], undefined);
  assert.equal(JSON.parse(next['frontend/package.json']).dependencies.next, '^14.1.0');
});

test('unified router fails over immediately on a rate-limited preferred model', async () => {
  await resetAllCooldowns();
  const calls: string[] = [];
  const providerFactory = (modelKey: string): LLMProvider => ({
    complete: async () => {
      calls.push(modelKey);
      if (modelKey === 'gemini-3.5-flash') {
        const error: any = new Error('rate limit exceeded');
        error.status = 429;
        throw error;
      }
      return 'fallback response';
    },
    async *stream() {
      yield 'response';
    },
  });

  const result = await completeWithPipelineFallback(
    'CODE_GENERATION',
    [{ role: 'user', content: 'test' }],
    undefined,
    undefined,
    providerFactory
  );

  assert.equal(result.text, 'fallback response');
  assert.equal(result.usedFallback, true);
  assert.deepEqual(calls, ['gemini-3.5-flash', 'kimi-k2.6']);
  assert.equal(await isModelCoolingDown('gemini-3.5-flash'), true);
  await resetAllCooldowns();
});

test('unified router honors an explicitly selected model before stage defaults', async () => {
  await resetAllCooldowns();
  const calls: string[] = [];
  const providerFactory = (modelKey: string): LLMProvider => ({
    complete: async () => {
      calls.push(modelKey);
      return 'selected response';
    },
    async *stream() {
      yield 'response';
    },
  });

  const result = await completeWithPipelineFallback(
    'REFINEMENT',
    [{ role: 'user', content: 'test' }],
    undefined,
    'qwen-3-32b',
    providerFactory
  );

  assert.equal(result.model, 'qwen-3-32b');
  assert.equal(result.text, 'selected response');
  assert.deepEqual(calls, ['qwen-3-32b']);
});

test('subagent compatibility tiers derive from unified pipeline routes', () => {
  assert.equal(SUBAGENT_TIERS.INGESTION, PIPELINE_ROUTES.INGESTION);
  assert.equal(SUBAGENT_TIERS.PLANNER, PIPELINE_ROUTES.PLANNING);
  assert.equal(SUBAGENT_TIERS.PATCH_GENERATOR, PIPELINE_ROUTES.DIFF_GENERATION);
  assert.equal(SUBAGENT_TIERS.SCHEMA_VERIFIER, PIPELINE_ROUTES.SCHEMA_VERIFIER);
});

test('partial streams fail explicitly instead of switching to a second response', async () => {
  await resetAllCooldowns();
  const providersCreated: string[] = [];
  const providerFactory = (modelKey: string): LLMProvider => {
    providersCreated.push(modelKey);
    return {
      complete: async () => 'unused',
      async *stream() {
        yield 'partial output';
        throw new Error('connection dropped after first chunk');
      },
    };
  };

  let received = '';
  await assert.rejects(
    (async () => {
      for await (const chunk of streamWithPipelineFallback(
        'CODE_GENERATION',
        [{ role: 'user', content: 'test' }],
        undefined,
        undefined,
        providerFactory
      )) {
        received += chunk;
      }
    })(),
    (err: unknown) => err instanceof PartialPipelineStreamError && err.emittedChunks === 1
  );

  assert.equal(received, 'partial output');
  assert.deepEqual(providersCreated, ['gemini-3.5-flash']);
  await resetAllCooldowns();
});
