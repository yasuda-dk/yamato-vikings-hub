import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#10233f',
        footballBlue: '#005bac',
        mist: '#f4f7fb',
        field: '#10233f',
        turf: '#005bac',
        line: '#e8f1ea',
        gold: '#005bac',
        ink: '#10233f',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(16, 35, 63, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
