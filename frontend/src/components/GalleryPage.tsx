import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { complexityColor } from '../lib/utils';
import { useBlueprintList } from '../hooks/useBlueprints';
import { SpotlightCard } from './SpotlightCard';
import { BlueprintCardSkeleton } from './BlueprintCardSkeleton';
import { PageHead } from './PageHead';
import { useAuth } from '../hooks/useAuth';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function GalleryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  const scope = (user && searchParams.get('scope') === 'mine') ? 'mine' : 'public';
  const isPersonal = scope === 'mine';
  
  const { data: items = [], isLoading, isError, refetch } = useBlueprintList(
    scope,
    scope === 'mine' ? Boolean(user) : true
  );

  return (
    <section className="px-4 sm:px-6 py-8 sm:py-12 max-w-5xl mx-auto overflow-hidden">
      <PageHead
        title={isPersonal ? 'My Blueprints' : 'Gallery'}
        description={
          isPersonal
            ? 'Your generated app blueprints'
            : 'Browse public blueprints from the BuildX community'
        }
      />

      <div className="mb-8 sm:mb-10">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3 sm:gap-4 mb-2">
          <div>
            <p
              className="font-mono-custom text-xs uppercase tracking-widest mb-2"
              style={{ color: 'var(--accent2)' }}
            >
              {isPersonal ? '// my blueprints' : '// blueprint gallery'}
            </p>
            <h1
              className="font-display font-extrabold text-2xl sm:text-3xl bg-gradient-to-r from-white via-slate-200 to-purple-400 bg-clip-text text-transparent"
              style={{ letterSpacing: '-1px' }}
            >
              {isPersonal ? 'My Blueprints' : 'Recent Blueprints'}
            </h1>
          </div>
          <Link
            to="/create"
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm font-medium transition-all duration-150 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              background: 'var(--accent)',
              borderColor: 'rgba(20,184,166,0.4)',
              color: 'white',
            }}
          >
            New Blueprint
          </Link>
        </div>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>
          {isPersonal
            ? 'Your generated blueprints. Click any card to view or refine.'
            : 'Browse public blueprints. Click any card to view the full blueprint.'}
        </p>
      </div>

      {user && (
        <div className="flex gap-2 border-b border-white/5 pb-4 mb-6">
          <button
            onClick={() => setSearchParams({ scope: 'public' })}
            className={`px-4 py-2 rounded-lg text-xs font-mono-custom transition-all ${
              scope === 'public'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            Community Gallery
          </button>
          <button
            onClick={() => setSearchParams({ scope: 'mine' })}
            className={`px-4 py-2 rounded-lg text-xs font-mono-custom transition-all ${
              scope === 'mine'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            My Blueprints
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy aria-label="Loading blueprints">
          {Array.from({ length: 6 }).map((_, i) => (
            <BlueprintCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="card p-6 text-center" style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--coral)' }}>
            Failed to load blueprints.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm px-4 py-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ borderColor: 'var(--border2)', color: 'var(--text2)' }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4" aria-hidden>
            🏗️
          </p>
          <h2 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>
            {isPersonal ? 'No blueprints yet' : 'No public blueprints'}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
            {isPersonal
              ? 'Generate your first blueprint to see it here.'
              : 'Be the first to publish a blueprint to the community!'}
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={{ background: 'var(--accent)' }}
          >
            {isPersonal ? 'Generate Blueprint' : 'Create & Share'}
          </Link>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
          {items.map((item, i) => (
            <li key={item.id}>
              <SpotlightCard
                onClick={() => navigate(`/blueprint/${item.id}`)}
                className="p-5 interactive-lift group block cursor-pointer w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                spotlightColor="rgba(20, 184, 166, 0.12)"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3
                    className="font-display font-bold text-sm truncate flex-1 group-hover:text-accent transition-colors"
                    style={{ color: 'var(--text)' }}
                  >
                    {item.appName}
                  </h3>
                  <span
                    className={`font-mono-custom text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${complexityColor(item.complexity as 'Low' | 'Medium' | 'High')}`}
                  >
                    {item.complexity}
                  </span>
                </div>
                <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--text3)' }}>
                  {item.description || item.idea}
                </p>
                <div className="flex items-center justify-between font-mono-custom text-[10px]" style={{ color: 'var(--text3)' }}>
                  <span>{timeAgo(item.createdAt)}</span>
                  <span style={{ color: 'var(--accent2)' }}>{item.views} views · Open →</span>
                </div>
              </SpotlightCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
