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

/** Parse flow string like "A → B → C" into steps array */
export function parseFlow(flow: string): string[] {
  return flow
    .split(/→|->|>/)
    .map((s) => s.trim())
    .filter(Boolean);
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
  { id: 'code', label: 'Starter Code' },
  { id: 'effort', label: 'Effort' },
] as const;
