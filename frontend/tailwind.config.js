/** Colours are CSS variables (src/index.css) so the whole console is themed in one place. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: v("deep"),
        hull: v("hull"),
        deck: v("deck"),
        line: v("line"),
        fog: v("fog"),
        slate: v("slate"),
        accent: v("accent"),
        signal: v("signal"),
        starboard: v("starboard"),
        port: v("port"),
        sky: v("sky"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: { card: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 8px 24px -12px rgb(0 0 0 / 0.5)" },
      fontSize: { "2xs": ["11px", "15px"] },
      keyframes: { in: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } } },
      animation: { in: "in .18s ease-out" },
    },
  },
  plugins: [],
};
