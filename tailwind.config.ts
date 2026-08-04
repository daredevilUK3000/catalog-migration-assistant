import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-deep": "rgb(var(--ink-deep-rgb) / <alpha-value>)",
        forest: "rgb(var(--forest-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        "paper-warm": "rgb(var(--paper-warm-rgb) / <alpha-value>)",
        brass: "rgb(var(--brass-rgb) / <alpha-value>)",
        "brass-bright": "rgb(var(--brass-bright-rgb) / <alpha-value>)",
        rust: "rgb(var(--rust-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
