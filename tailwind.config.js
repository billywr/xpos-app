/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        // Light bluish surface palette for stunning default UI
        surface: {
          50: "#f8fbfd",
          100: "#f0f7fc",
          200: "#e2eff9",
          300: "#cce3f4",
          400: "#b5d4ed",
          500: "#93c2e4",
        },
      },
    },
  },
  plugins: [],
};
