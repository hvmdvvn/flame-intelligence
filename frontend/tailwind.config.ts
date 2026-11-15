import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        raise: "rgb(var(--raise) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
        brass: "rgb(var(--brass) / <alpha-value>)",
        mist: "rgb(var(--mist) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        good: "rgb(var(--good) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        sheet: "0 24px 80px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
