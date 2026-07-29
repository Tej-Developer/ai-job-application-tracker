/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEF1F4",
        ink: "#172436",
        board: {
          DEFAULT: "#101B27",
          2: "#182739",
        },
        amber: {
          DEFAULT: "#E8A23D",
          deep: "#C97F1E",
          soft: "#FBEBD3",
        },
        green: {
          DEFAULT: "#2F8F5B",
          soft: "#DEF0E5",
        },
        rust: {
          DEFAULT: "#B24A3D",
          soft: "#F5DFDB",
        },
        slate: {
          DEFAULT: "#4C6B92",
          soft: "#E2E9F1",
        },
        line: "#D9DEE3",
        muted: "#5C6B7A",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 16px 34px -18px rgba(23,36,54,0.25)",
        board: "0 24px 60px -20px rgba(16,27,39,0.55)",
      },
      keyframes: {
        "flip-in": {
          "0%": { opacity: "0", transform: "perspective(400px) rotateX(-90deg)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "perspective(400px) rotateX(0deg)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-10px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "flip-in": "flip-in 0.55s cubic-bezier(.2,.9,.3,1) forwards",
        "fade-up": "fade-up 0.4s ease forwards",
        "toast-in": "toast-in 0.25s ease forwards",
      },
    },
  },
  plugins: [],
};
