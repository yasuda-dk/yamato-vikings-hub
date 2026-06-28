import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        field: '#132a21',
        turf: '#1f7a4d',
        line: '#e8f1ea',
        gold: '#f2b84b',
        ink: '#17211c',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(19, 42, 33, 0.16)',
      },
    },
  },
  plugins: [],
} satisfies Config;
