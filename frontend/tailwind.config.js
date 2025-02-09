/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // VS Code-inspired dark theme palette
        editor: {
          bg: "#1e1e1e",
          sidebar: "#252526",
          panel: "#1e1e1e",
          toolbar: "#3c3c3c",
          border: "#474747",
          hover: "#2a2d2e",
          active: "#37373d",
          text: "#cccccc",
          muted: "#858585",
          accent: "#007acc",
          accentHover: "#1a8ad4",
          success: "#4ec9b0",
          warning: "#ce9178",
          error: "#f44747",
          info: "#9cdcfe",
        },
      },
      fontFamily: {
        mono: ["'Cascadia Code'", "'Fira Code'", "Consolas", "monospace"],
        sans: ["'Segoe UI'", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-in-out",
        "slide-in": "slideIn 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { transform: "translateX(-8px)", opacity: 0 }, to: { transform: "translateX(0)", opacity: 1 } },
      },
    },
  },
  plugins: [],
};
