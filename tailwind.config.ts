import type { Config } from "tailwindcss";

const designTokens = {
  colors: {
    dark: "#050508",
    background: "#050508",
    surface: "#0A0612",
    // Gothic-Morphism Void Purple System
    void: {
      DEFAULT: "#8B00FF",
      bright: "#BC00FB",
      dim: "#4A007A",
      glow: "rgba(139, 0, 255, 0.35)",
      neon: "rgba(188, 0, 251, 0.8)",
    },
    // Obsidian glass
    obsidian: {
      DEFAULT: "rgba(8, 4, 18, 0.75)",
      border: "rgba(60, 20, 100, 0.6)",
    },
    primary: {
      DEFAULT: "#A5A9B4",
      dim: "#4A4D55",
      glow: "rgba(165, 169, 180, 0.2)",
    },
    secondary: {
      DEFAULT: "#D4AF37",
      dim: "#8A6D1F",
      glow: "rgba(212, 175, 55, 0.2)",
    },
    tertiary: {
      DEFAULT: "#8B0000",
      dim: "#4A0000",
      glow: "rgba(139, 0, 0, 0.2)",
    },
    necro: {
      DEFAULT: "#1A1A1A",
      glow: "rgba(255, 255, 255, 0.05)",
    },
    error: "#8B0000",
    cursedGold: "#D4AF37",
    iron: "#2C2C2C",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
  },
  borderRadius: {
    none: "0",
    sm: "1px",
    md: "2px",
    lg: "4px",
    xl: "8px",
    full: "9999px",
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
        headline: ["Space Grotesk", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Plus Jakarta Sans", "sans-serif"],
        system: ["DotGothic16", "monospace"],
        cinzel: ['var(--font-cinzel)', 'serif'],
        noto: ['var(--font-noto-sans-jp)', 'sans-serif'],
        space: ['var(--font-space-grotesk)', 'sans-serif'],
      },
      backgroundImage: {
        'liquid-fill': 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 20%, rgba(0, 255, 171, 0.5) 100%)',
        'liquid-fill-tertiary': 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 20%, rgba(255, 107, 155, 0.5) 100%)',
        'dot-pattern': 'url("data:image/svg+xml,%3Csvg width=\\"4\\" height=\\"4\\" viewBox=\\"0 0 4 4\\" fill=\\"none\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Ccircle cx=\\"1\\" cy=\\"1\\" r=\\"0.5\\" fill=\\"rgba(255,255,255,0.08)\\"/%3E%3C/svg%3E")',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'hologram-scan': 'hologram-scan 4s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.5)' },
        },
        'hologram-scan': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '0% 100%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
