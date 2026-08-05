import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Bumped up from Tailwind's defaults so every text-* class app-wide
      // renders larger — a global size increase, not a per-page one.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],   // 13px (was 12px)
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],    // 15px (was 14px)
        base: ["1.0625rem", { lineHeight: "1.625rem" }],  // 17px (was 16px)
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],     // 19px (was 18px)
        xl: ["1.3125rem", { lineHeight: "1.875rem" }],    // 21px (was 20px)
        "2xl": ["1.625rem", { lineHeight: "2.125rem" }],  // 26px (was 24px)
        "3xl": ["2rem", { lineHeight: "2.375rem" }],      // 32px (was 30px)
        "4xl": ["2.5rem", { lineHeight: "2.75rem" }],     // 40px (was 36px)
        "5xl": ["3.25rem", { lineHeight: "1" }],          // 52px (was 48px)
        "6xl": ["4rem", { lineHeight: "1" }],             // 64px (was 60px)
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      ringWidth: {
        3: "3px",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
};
export default config;
