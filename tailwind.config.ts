import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0e17", panel: "#111726", line: "#1e2839",
        muted: "#7d8aa3", accent: "#5b8cff", accent2: "#22d3ee",
        hot: "#ff5470", warm: "#ffb020", nurture: "#5b8cff", watch: "#7d8aa3",
        ok: "#2dd4a7",
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
    },
  },
  plugins: [],
} satisfies Config;
