import type { Config } from "tailwindcss";

const designTokens = {
  colors: {
    dark: "#0a0a0a",
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
    // Strict spacing rules
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  borderRadius: {
    // Strict border radius rules
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
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
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'necro-gradient': 'linear-gradient(to bottom, #0a0a0a, #2a0035)',
      },
    },
  },
  plugins: [],
};

export default config;
