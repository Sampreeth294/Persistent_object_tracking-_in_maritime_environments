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
        signal: v("signal"),
        starboard: v("starboard"),
        port: v("port"),
        sky: v("sky"),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "4px", sm: "2px" },
      fontSize: { "2xs": ["11px", "14px"] },
    },
  },
  plugins: [],
};
