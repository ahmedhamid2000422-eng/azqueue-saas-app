/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:        "#0b0b0c",
        "bg-elev": "#131315",
        surface:   "#17171a",
        "surface-2":"#1a1a1d",
        line:      "#26262a",
        "line-2":  "#323238",
        gold:      "#c9a86a",
        "gold-soft":"#e4cb95",
        "gold-deep":"#8a7246",
        ink:       "#f2f0ea",
        "ink-soft":"#a8a69e",
        "ink-mute":"#6e6c65",
        good:      "#7fa37f",
        warn:      "#c9a86a",
        bad:       "#b56b5f",
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.03em",
        ovline: "0.2em",
      },
    },
  },
  plugins: [],
};
