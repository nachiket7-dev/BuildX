import { clsx, type ClassValue } from 'clsx';
import type { HttpMethod } from './types';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function methodClass(method: HttpMethod): string {
  const map: Record<HttpMethod, string> = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete',
  };
  return map[method] ?? 'method-get';
}

export function complexityMetaClass(complexity: string): string {
  if (complexity === 'Low') return 'bp-meta bp-meta--complexity-low';
  if (complexity === 'High') return 'bp-meta bp-meta--complexity-high';
  return 'bp-meta bp-meta--complexity-medium';
}

/** @deprecated Use complexityMetaClass for blueprint header pills */
export function complexityColor(complexity: string): string {
  if (complexity === 'Low') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
  if (complexity === 'High') return 'text-red-400 border-red-400/30 bg-red-400/10';
  return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
}

/** Safely escape HTML for display in code blocks */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Parse flow strings like "React → Express → PostgreSQL" into step labels */
export function parseFlow(flow: string): string[] {
  if (!flow?.trim()) return [];

  const normalized = flow
    .replace(/[\u2794\u279C\u27A1\u27F6\u2192\u21D2\u21E8]/g, ' → ')
    .replace(/\s*(?:->|=>)\s*/g, ' → ')
    .replace(/\s+to\s+/gi, ' → ');

  const steps = normalized
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean);

  if (steps.length > 1) return steps;

  // Avoid splitting on bare ">" — it breaks paths and comparisons
  return steps.length === 1 ? steps : [];
}

export function flowStepRole(index: number, total: number): string {
  if (total <= 1) return 'End-to-end request path';
  if (index === 0) return 'Client / Frontend';
  if (index === total - 1) return 'Database / Storage';
  return 'API / Backend';
}

/** Prefer parsed flow steps; fall back to stack layers when flow is one blob */
export function resolveFlowSteps(flow: string, stack?: { frontend: string; backend: string; database: string }): string[] {
  const parsed = parseFlow(flow);
  if (parsed.length > 1) return parsed;

  if (stack) {
    const fromStack = [stack.frontend, stack.backend, stack.database]
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromStack.length > 1) return fromStack;
  }

  return parsed.length ? parsed : ['Request flow'];
}

export const EXAMPLE_IDEAS = [
  {
    label: 'Food Delivery',
    idea: 'A food delivery app with restaurant listings, real-time order tracking, cart, reviews, and Stripe payments',
  },
  {
    label: 'CRM SaaS',
    idea: 'A SaaS CRM for small businesses with contacts, deal pipelines, email tracking, tasks, and team collaboration',
  },
  {
    label: 'EdTech Platform',
    idea: 'An online learning platform with video courses, quizzes, progress tracking, certificates, and instructor dashboards',
  },
  {
    label: 'Freelance Marketplace',
    idea: 'A freelance marketplace connecting clients with developers — with job postings, bids, contracts, and escrow payments',
  },
  {
    label: 'Real Estate',
    idea: 'A real estate platform with property listings, virtual tours, mortgage calculator, saved searches, and agent profiles',
  },
  {
    label: 'HealthTech',
    idea: 'A healthcare app with doctor listings, appointment booking, video consultations, prescriptions, and patient records',
  },
  {
    label: 'E-Commerce',
    idea: 'A multi-vendor e-commerce marketplace with product listings, inventory management, orders, reviews, and seller analytics',
  },
  {
    label: 'Social Fitness',
    idea: 'A fitness social app where users log workouts, track goals, follow friends, join challenges, and share achievements',
  },
] as const;

export const TABS = [
  { id: 'features', label: 'Features' },
  { id: 'schema', label: 'Database' },
  { id: 'api', label: 'API Endpoints' },
  { id: 'ui', label: 'UI Screens' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'diagrams', label: 'Diagrams' },
  { id: 'effort', label: 'Effort' },
] as const;

export function formatSQL(sql: string): string {
  if (!sql) return '';
  
  const cleanSql = sql.trim();
  const statements: string[] = [];
  let currentStatement = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  
  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    const nextChar = cleanSql[i + 1] || '';
    
    // Handle comments
    if (!inDoubleQuote && !inSingleQuote) {
      if (char === '-' && nextChar === '-') {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
        let comment = '';
        while (i < cleanSql.length && cleanSql[i] !== '\n') {
          comment += cleanSql[i];
          i++;
        }
        statements.push(comment.trim());
        continue;
      }
    }
    
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }
    
    currentStatement += char;
    
    if (char === ';' && !inDoubleQuote && !inSingleQuote) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  const formatted: string[] = [];
  for (const stmt of statements) {
    if (stmt.startsWith('--')) {
      formatted.push(stmt);
      continue;
    }
    
    const createTableMatch = stmt.match(/^(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([a-zA-Z0-9_`"]+)\s*\(([\s\S]*)\);?$/i);
    if (createTableMatch) {
      const prefix = createTableMatch[1];
      const tableName = createTableMatch[2];
      const colsString = createTableMatch[3].trim();
      
      const columns: string[] = [];
      let current = '';
      let depth = 0;
      for (let j = 0; j < colsString.length; j++) {
        const c = colsString[j];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        
        if (c === ',' && depth === 0) {
          columns.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      if (current.trim()) {
        columns.push(current.trim());
      }
      
      const formattedCols = columns
        .map(col => `  ${col}`)
        .join(',\n');
        
      formatted.push(`${prefix.trim()} ${tableName} (\n${formattedCols}\n);`);
    } else {
      let formattedStmt = stmt;
      if (!formattedStmt.endsWith(';') && !formattedStmt.startsWith('--')) {
        formattedStmt += ';';
      }
      formatted.push(formattedStmt);
    }
  }
  
  return formatted.join('\n\n');
}

/**
 * Generate a cryptographically secure random state string for OAuth CSRF protection.
 * Uses crypto.getRandomValues for security instead of Math.random.
 */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Start the GitHub OAuth flow for either a new session or an account link. */
export function startGithubOAuth(mode: 'login' | 'link', redirectPath: string): void {
  sessionStorage.setItem('buildx_auth_redirect', redirectPath);
  if (mode === 'link') {
    sessionStorage.setItem('buildx_github_link', 'true');
  } else {
    sessionStorage.removeItem('buildx_github_link');
  }

  const state = generateOAuthState();
  sessionStorage.setItem('buildx_github_oauth_state', state);
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
  const redirectUri = encodeURIComponent(window.location.origin + '/login/callback');
  window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email,repo&redirect_uri=${redirectUri}&state=${state}`;
}
