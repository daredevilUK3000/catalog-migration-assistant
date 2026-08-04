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
      // rgb(var(--x-rgb) / <alpha-value>) is Tailwind's documented pattern
      // for a CSS-variable-backed color that still supports opacity
      // modifiers (bg-ink-deep/90, text-paper/70, etc.) — plain
      // bg-[var(--ink-deep)]/90 arbitrary values don't, and silently
      // produce no CSS at all. See the --x-rgb variables in globals.css.
      colors: {
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          deep: "rgb(var(--ink-deep-rgb) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          warm: "rgb(var(--paper-warm-rgb) / <alpha-value>)",
        },
        brass: {
          DEFAULT: "rgb(var(--brass-rgb) / <alpha-value>)",
          bright: "rgb(var(--brass-bright-rgb) / <alpha-value>)",
        },
        rust: "rgb(var(--rust-rgb) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
