import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: '#722F37',
          50: '#F5E6E8',
          100: '#E8CDD1',
          200: '#D19BA3',
          300: '#BA6975',
          400: '#A33747',
          500: '#722F37',
          600: '#5B262C',
          700: '#441C21',
          800: '#2D1316',
          900: '#16090B',
        },
        secondary: {
          DEFAULT: '#D4AF37',
          50: '#FAF7EB',
          100: '#F4EED7',
          200: '#EADDB0',
          300: '#DFCC88',
          400: '#D4BB60',
          500: '#D4AF37',
          600: '#A98C2C',
          700: '#7F6921',
          800: '#544616',
          900: '#2A230B',
        },
      },
    },
  },
  plugins: [],
};
export default config;
