import type { Config } from "tailwindcss";

const designTokens = {
  colors: {
    dark: "#0a0b14",
    primary: {
      DEFAULT: "#BC00FB", // Amethyst / Neon Purple
      glow: "rgba(188, 0, 251, 0.6)",
      dim: "rgba(188, 0, 251, 0.2)",
    },
    secondary: {
      DEFAULT: "#00FFFF", // Cyan
      glow: "rgba(0, 255, 255, 0.6)",
      dim: "rgba(0, 255, 255, 0.2)",
    },
    fuchsia: {
      DEFAULT: "#FF00FF", // Neon Pink
      glow: "rgba(255, 0, 255, 0.6)",
      dim: "rgba(255, 0, 255, 0.2)",
    },
    necro: {
      DEFAULT: "#2a0035",
      glow: "rgba(188, 0, 251, 0.4)",
      dim: "rgba(42, 0, 53, 0.4)",
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
    "2xl": "1.5rem",
    "3xl": "2.5rem",
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
        'necro-gradient': 'linear-gradient(to bottom, #0a0b14, #1a0a2a)',
        'dither-pattern': 'url("data:image/svg+xml,%3Csvg width=\\"2\\" height=\\"2\\" viewBox=\\"0 0 2 2\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Crect width=\\"1\\" height=\\"1\\" fill=\\"rgba(255,255,255,0.1)\\"/%3E%3Crect x=\\"1\\" y=\\"1\\" width=\\"1\\" height=\\"1\\" fill=\\"rgba(255,255,255,0.1)\\"/%3E%3C/svg%3E")',
        'dot-pattern': 'url("data:image/svg+xml,%3Csvg width=\\"4\\" height=\\"4\\" viewBox=\\"0 0 4 4\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Ccircle cx=\\"1\\" cy=\\"1\\" r=\\"0.5\\" fill=\\"rgba(255,255,255,0.08)\\"/%3E%3C/svg%3E")',
      },
    },
  },
  plugins: [],
};

export default config;
