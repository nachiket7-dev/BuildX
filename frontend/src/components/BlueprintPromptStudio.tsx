import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowLeft, Cpu, Terminal, Zap, Layers, ChevronRight, Check } from 'lucide-react';
import { useModel, type ModelId } from '../hooks/useModel';
import { useBlueprintSession } from '../hooks/useBlueprintSession';

interface Preset {
  id: string;
  tag: string;
  title: string;
  prompt: string;
  category: string;
  iconText: string;
}

const PRESETS: Preset[] = [
  {
    id: 'p1',
    tag: '01 / HealthTech',
    title: 'HIPAA Telehealth Engine',
    category: 'Healthcare',
    iconText: '🏥',
    prompt: 'Build a HIPAA-compliant telemedicine platform with patient appointment scheduling, secure WebRTC video consultation rooms, prescription dispatch tracking, and PostgreSQL database schema.',
  },
  {
    id: 'p2',
    tag: '02 / FinTech',
    title: 'Quantum Settlement Gateway',
    category: 'Finance',
    iconText: '💳',
    prompt: 'Design a real-time multi-currency payment settlement engine featuring AI fraud detection webhooks, idempotent transaction logging, ledger audits, and Stripe backend integration.',
  },
  {
    id: 'p3',
    tag: '03 / AI Agent IDE',
    title: 'Agentic Code Workspace',
    category: 'Developer Tools',
    iconText: '🤖',
    prompt: 'Create an autonomous AI coding IDE workspace with Monaco editor tab splitting, live sandbox previews, multi-file diff patch generators, and agentic timeline execution streaming.',
  },
  {
    id: 'p4',
    tag: '04 / E-Commerce',
    title: 'Headless Commerce Engine',
    category: 'E-Commerce',
    iconText: '🛒',
    prompt: 'Build a high-concurrency headless e-commerce store with Redis inventory caching, Stripe Checkout session APIs, dynamic customer recommendations, and order management views.',
  },
];

const MODELS = [
  { id: 'gemini-3.5-flash' as const, name: 'Kimi K2.6 / Gemini 3.5 Engine', description: 'Deep reasoning architecture & DDL schemas' },
  { id: 'nemotron-3-550b' as const, name: 'NVIDIA Nemotron 3', description: 'Enterprise structural integrity' },
  { id: 'qwen-3-32b' as const, name: 'Qwen 3 32B Pro', description: 'Ultra-fast streaming pipeline' },
];

export function BlueprintPromptStudio() {
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel } = useModel();
  const { generate } = useBlueprintSession();

  const [promptText, setPromptText] = useState('');
  const [activeModel, setActiveModel] = useState<ModelId>(selectedModel || 'gemini-3.5-flash');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: Preset) => {
    setPromptText(preset.prompt);
    setSelectedPresetId(preset.id);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    setIsSubmitting(true);
    generate(promptText, selectedModel || activeModel);
    navigate('/create');
  };

  return (
    <div className="w-full space-y-10 pb-36 font-sans">
      {/* Elevated Glass Console Card */}
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Subtle top interior glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-purple-500/10 blur-[50px] pointer-events-none rounded-full" />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-brand-borderSubtle">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold text-brand-glow bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
              00 / PROMPT STUDIO
            </span>
            <span className="hidden sm:inline text-xs text-zinc-500 font-mono">
              Multi-Model AI Architecture Generator
            </span>
          </div>

          <Link
            to="/blueprints"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface2 border border-brand-border text-xs font-mono text-zinc-400 hover:text-white hover:border-brand-accent/40 transition-all shadow-sm"
          >
            <ArrowLeft size={13} />
            <span>← Back to Blueprints</span>
          </Link>
        </div>

        {/* Console Form */}
        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Main Prompt Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold">
              System Specification Prompt
            </label>
            <div className="relative">
              <textarea
                rows={5}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Describe your app idea in detail... (e.g. 'Build a SaaS billing dashboard with multi-tenant PostgreSQL schema, Stripe webhooks, and React analytics widgets')"
                className="w-full bg-brand-bg border border-brand-border focus:border-brand-accent focus:ring-1 focus:ring-purple-500/30 text-xs sm:text-sm text-white placeholder-zinc-500 rounded-xl p-4 font-mono outline-none transition-all leading-relaxed resize-y"
              />
              <div className="absolute bottom-3 right-3 text-[10px] font-mono text-zinc-500">
                {promptText.length} chars
              </div>
            </div>
          </div>

          {/* Quick Presets Row */}
          <div className="space-y-2">
            <span className="block text-[11px] font-mono text-zinc-500 uppercase">
              Quick Architecture Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/40 text-brand-glow font-semibold shadow-sm'
                        : 'bg-brand-surface2 border-brand-border text-zinc-300 hover:text-white hover:border-brand-accent/30'
                    }`}
                  >
                    <span>{preset.iconText}</span>
                    <span>{preset.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Execution Bar: Model Selector + Generate CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-brand-borderSubtle font-mono">
            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Cpu size={15} className="text-brand-green shrink-0" />
              <select
                value={activeModel}
                onChange={(e) => {
                  const m = e.target.value as ModelId;
                  setActiveModel(m);
                  setSelectedModel(m);
                }}
                className="bg-brand-bg border border-brand-border text-xs font-mono text-zinc-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-accent transition-all cursor-pointer w-full sm:w-64"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-brand-surface text-white">
                    🟢 {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Blueprint CTA Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={!promptText.trim() || isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 border border-purple-400/30 disabled:opacity-40 font-mono"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Generate Blueprint →</span>
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>

      {/* Inspiration Template Grid (3 Columns) */}
      <div className="space-y-4 font-mono">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase text-zinc-400 tracking-wider font-semibold">
            INSPIRATION & TEMPLATES
          </h3>
          <span className="text-[10px] text-zinc-500">03 ARCHITECTURAL PATTERNS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              num: '01 / SYSTEM',
              title: 'Multi-Tenant SaaS Core',
              desc: 'Row-level security PostgreSQL schemas, JWT session tokens, organization RBAC roles, and Stripe billings.',
              badge: 'PostgreSQL + Node',
            },
            {
              num: '02 / AGENT',
              title: 'Streaming Multi-Model Agent',
              desc: 'SSE event streaming, tool call execution registries, state memory buffer, and fallback engine routers.',
              badge: 'FastAPI + Python',
            },
            {
              num: '03 / EDGE',
              title: 'High-Concurrency Edge API',
              desc: 'Redis pub/sub channels, Cloudflare worker endpoints, rate limiters, and serverless WebSocket rooms.',
              badge: 'TypeScript + Redis',
            },
          ].map((tpl) => (
            <div
              key={tpl.num}
              onClick={() => {
                setPromptText(`Build a ${tpl.title}: ${tpl.desc}`);
              }}
              className="bg-brand-surface border border-brand-border hover:border-brand-accent/40 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 space-y-3 group shadow-md"
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-brand-glow font-semibold">{tpl.num}</span>
                <span className="text-zinc-400 bg-brand-bg border border-brand-border px-2 py-0.5 rounded">
                  {tpl.badge}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-brand-glow transition-colors font-sans">
                {tpl.title}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                {tpl.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
