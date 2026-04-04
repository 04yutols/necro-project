import type { Config } from "tailwindcss";

const designTokens = {
  colors: {
    dark: "#0a0a0a",
    primary: {
      DEFAULT: "#e08dff",
      glow: "rgba(224,141,255,0.5)",
      dim: "rgba(224,141,255,0.2)",
    },
    secondary: {
      DEFAULT: "#00ffab",
      glow: "rgba(0,255,171,0.5)",
      dim: "rgba(0,255,171,0.2)",
    },
    blood: {
      DEFAULT: "#880808",
      glow: "rgba(136,8,8,0.5)",
      dim: "rgba(136,8,8,0.2)",
    },
    necro: {
      DEFAULT: "#2a0035",
      glow: "rgba(168,85,247,0.3)",
      dim: "rgba(42,0,53,0.4)",
    },
    cursedGold: "#ffd700",
  },
  spacing: {
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    capsule: "9999px",
  },
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: designTokens.colors,
      spacing: designTokens.spacing,
      borderRadius: designTokens.borderRadius,
      fontFamily: {
        cinzel: ['var(--font-cinzel)', 'serif'],
        noto: ['var(--font-noto-sans-jp)', 'sans-serif'],
        space: ['var(--font-space-grotesk)', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'necro-gradient': 'linear-gradient(to bottom, #0a0a0a, #1a0a2a)',
        'dither-pattern': 'url("data:image/svg+xml,%3Csvg width=\\"4\\" height=\\"4\\" viewBox=\\"0 0 4 4\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cpath d=\\"M0 0H2V2H0V0ZM2 2H4V4H2V2Z\\" fill=\\"rgba(255,255,255,0.05)\\"/%3E%3C/svg%3E")',
      },
    },
  },
  plugins: [],
};

export default config;
