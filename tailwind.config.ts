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
        'wa-dark':   '#111B21',
        'wa-panel':  '#202C33',
        'wa-hover':  '#2A3942',
        'wa-border': '#374045',
        'wa-green':  '#00A884',
        'wa-text':   '#E9EDEF',
        'wa-muted':  '#8696A0',
        'wa-sent':   '#005C4B',
        'wa-received': '#1F2C34',
      },
    },
  },
  plugins: [],
};

export default config;
