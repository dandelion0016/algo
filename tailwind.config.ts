import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        algo: {
          yellow: "#FCF97A",
          "yellow-light": "#FEFDDB",
          "yellow-dark": "#E6E24E",
          blue: "#7BA6EF",
          "blue-light": "#EEF4FD",
          "blue-dark": "#4F82DF",
          navy: "#1E2A44",
          slate: "#334155",
          sand: "#FAF9F5",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Hiragino Sans'",
          "'Noto Sans JP'",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
