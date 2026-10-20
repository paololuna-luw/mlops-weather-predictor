import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        lake: {
          950: "#07141c",
          900: "#0c1e28",
          800: "#123140",
        },
        reed: {
          200: "#f0ddc0",
          400: "#e2b56a",
          500: "#c9843a",
        },
        glacial: {
          200: "#d5f3ee",
          400: "#7fd1c4",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 24px 60px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
