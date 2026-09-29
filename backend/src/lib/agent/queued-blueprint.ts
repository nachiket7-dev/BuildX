import { BlueprintRequestSchema, BlueprintSchema } from '../types';
import { assertWithinUsageLimit, getUsageCount } from '../db';
import { isPremiumModel, resolveModelId } from '../llm/router';
import { buildBlueprint } from './blueprint';
import type { AgentState } from './engine';
import type { JobHandler } from './worker';

/** Persist the project and completed job in the same fenced transaction. */
export const queuedBlueprintHandler: JobHandler = async (job, context) => {
  const { idea, model, stack } = BlueprintRequestSchema.parse(job.payload);
  const premium = isPremiumModel(model);
  const modelId = premium ? resolveModelId(model) : undefined;
  if (modelId) assertWithinUsageLimit(await getUsageCount(job.owner_id, modelId), modelId, 5);
  const checkpoint = job.checkpoint as { state?: AgentState; blueprint?: unknown } | null;
  const blueprint = checkpoint?.blueprint
    ? BlueprintSchema.parse(checkpoint.blueprint)
    : await buildBlueprint(idea, model, stack, {}, context.signal, undefined, undefined, {
      resume: checkpoint?.state,
      checkpoint: state => context.checkpoint({ state }),
    });
  context.signal.throwIfAborted();
  // Avoid another model call if execution dies between generation and commit.
  await context.checkpoint({ blueprint });
  const id = job.id.replace(/-/g, '').slice(0, 16);
  return {
    result: { id, data: blueprint },
    commit: async client => {
      if (modelId) {
        const usage = await client.query(`INSERT INTO model_usage(user_id,model,date,count)
          VALUES($1,$2,(clock_timestamp() AT TIME ZONE 'UTC')::date,1)
          ON CONFLICT(user_id,model,date) DO UPDATE SET count=model_usage.count+1
          WHERE model_usage.count<5 RETURNING count`, [job.owner_id, modelId]);
        if (!usage.rowCount) throw new Error('Daily model limit reached before completion');
      }
      await client.query('INSERT INTO blueprints(id,idea,blueprint,user_id,is_public) VALUES($1,$2,$3,$4,false)',
        [id, idea, JSON.stringify(blueprint), job.owner_id]);
    },
  };
};
