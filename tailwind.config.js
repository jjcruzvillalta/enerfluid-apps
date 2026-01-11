/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/app/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        navy: "#16213c",
        mist: "#eef2f7",
        cloud: "#f7f9fc",
        line: "#e2e8f0",
        accent: "#1f6feb",
        accentSoft: "#e6efff",
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 42, 0.12)",
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [animate],
};
