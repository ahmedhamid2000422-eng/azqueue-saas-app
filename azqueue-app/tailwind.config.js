/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Aligned with the inline-styled marketing pages — same hex values
        // are used in Landing.jsx, Resources.jsx, CaseStudy.jsx, etc.
        bg:        "#080807",  // void
        "bg-elev": "#0c0c0b",  // card
        surface:   "#111110",  // panel
        "surface-2":"#131210",
        line:      "rgba(255,255,255,0.07)",
        "line-2":  "rgba(255,255,255,0.12)",
        gold:      "#b8955a",
        "gold-soft":"#d4b478",
        "gold-deep":"#8a7246",
        ink:       "#f0ede6",
        "ink-soft":"#bdbab2",
        "ink-mute":"#60605a",
        good:      "#7fa37f",
        warn:      "#b8955a",
        bad:       "#b56b5f",
      },
      fontFamily: {
        // Display font unified with the inline-styled marketing pages —
        // Georgia is the same serif used on Landing, Product, Industries,
        // Resources, ResourceArticle, CaseStudy, Login, Signup, Support, Company.
        // Keeping Fraunces as a fallback for anyone who has it installed.
        display: ['Georgia', '"Times New Roman"', 'Fraunces', 'serif'],
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
