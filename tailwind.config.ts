import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#080C10',
        'bg-surface': '#0E1419',
        'bg-elevated': '#151C24',
        'accent': '#00FF85',
        'accent-dim': '#00CC6A',
        'content': '#E8EDF2',
        'muted': '#8896A4',
        'danger': '#FF4D6D',
        'warning': '#FFB347',
        'border-subtle': 'rgba(255,255,255,0.06)',
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px #00FF85, 0 0 10px #00FF85' },
          '100%': { boxShadow: '0 0 20px #00FF85, 0 0 40px #00FF8580' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'accent': '0 0 20px rgba(0, 255, 133, 0.3)',
        'accent-lg': '0 0 40px rgba(0, 255, 133, 0.4)',
        'danger': '0 0 20px rgba(255, 77, 109, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
