import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#382d49",
        lake: "#4c7fe6",
        deep: "#3a5cba",
        mist: "#e4e8f5",
        totora: "#8a6fc4",
      },
      fontFamily: {
        sans: ["Lato", "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 18px 50px rgba(56, 45, 73, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
