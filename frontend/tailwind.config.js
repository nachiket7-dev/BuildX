/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'Geist', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'ui-monospace', 'monospace'],
        display: ['Bricolage Grotesque', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          bg: '#050807',
          surface: '#090D0B',
          panel: '#0C2720',
          subpanel: '#070A09',
          terminal: '#040605',
          header: '#092017',
          border: 'rgba(16, 185, 129, 0.2)',
          borderSubtle: 'rgba(255, 255, 255, 0.05)',
        },
        sylven: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
          glow: 'rgba(16, 185, 129, 0.15)',
        },
        norvin: {
          silver: '#E2E8F0',
          muted: '#94A3B8',
          dim: '#475569',
          ivory: '#F8FAFC',
        },
        brand: {
          bg: '#050807',
          surface: '#090D0B',
          surface2: '#0C2720',
          surface3: '#13151A',
          border: 'rgba(16, 185, 129, 0.2)',
          borderSubtle: 'rgba(255, 255, 255, 0.05)',
          accent: '#10B981',
          glow: '#34D399',
          green: '#10B981',
          cyan: '#38BDF8',
          amber: '#F59E0B',
          silver: '#E2E8F0',
          muted: '#94A3B8',
        },
        border: "rgba(16, 185, 129, 0.2)",
        input: "#0C2720",
        ring: "#10B981",
        background: "#050807",
        foreground: "#F8FAFC",
        primary: {
          DEFAULT: "#10B981",
          foreground: "#0B0C0E",
        },
        secondary: {
          DEFAULT: "#1A1D24",
          foreground: "#F8FAFC",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#1A1D24",
          foreground: "#94A3B8",
        },
        accent: {
          DEFAULT: "#10B981",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#13151A",
          foreground: "#F8FAFC",
        },
        card: {
          DEFAULT: "#13151A",
          foreground: "#F8FAFC",
        },
        bg: {
          DEFAULT: '#0B0C0E',
          surface: '#13151A',
          surface2: '#1A1D24',
          surface3: '#262932',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(20,184,166,0.15)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 45px rgba(20,184,166,0.35)', transform: 'scale(1.05)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        terminalPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        breathe: 'breathe 2.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'terminal-cursor': 'terminalPulse 1s step-end infinite',
        'glitch': 'glitch 1s linear infinite',
      },
    },
  },
  plugins: [],
};
