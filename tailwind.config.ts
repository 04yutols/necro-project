import type { Config } from "tailwindcss";

const designTokens = {
  colors: {
    dark: "#0B0E14",
    background: "#0B0E14",
    surface: "#10131A",
    primary: {
      DEFAULT: "#E08DFF", // Light Neon Purple
      dim: "#BC00FB",
      glow: "rgba(191, 0, 255, 0.6)",
    },
    secondary: {
      DEFAULT: "#00FFAB", // Neon Green/Cyan
      dim: "#00EFA0",
      glow: "rgba(0, 255, 171, 0.6)",
    },
    tertiary: {
      DEFAULT: "#FF6B9B", // Neon Pink
      dim: "#E30071",
      glow: "rgba(255, 107, 155, 0.6)",
    },
    necro: {
      DEFAULT: "#BF00FF",
      glow: "rgba(191, 0, 255, 0.4)",
    },
    error: "#FF6E84",
    cursedGold: "#FFD700",
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
    lg: "1rem",
    xl: "2rem",
    "2xl": "3rem",
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
