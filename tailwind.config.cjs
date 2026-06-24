/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './systems/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx,css}',
    './types.ts',
    './constants.ts',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
