/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['DM Mono', 'Fira Code', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          surface: '#111118',
          surface2: '#18181f',
          surface3: '#1f1f28',
        },
        accent: {
          DEFAULT: '#7c6aff',
          light: '#a78bfa',
          glow: 'rgba(124,106,255,0.2)',
        },
        emerald: {
          glow: '#22d3a5',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        breathe: 'breathe 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124,106,255,0.2)' },
          '50%': { boxShadow: '0 0 50px rgba(124,106,255,0.5)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
