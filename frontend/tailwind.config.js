/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{vue,ts}',
    '../public_html/**/*.php',
    '../public_html/**/*.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
    require('@tailwindcss/typography'),
  ],
  daisyui: {
    themes: [
      {
        velogrimpe: {
          "primary": "oklch(56.85% 0.1187 154.95)",
          "primary-focus": "oklch(42.91% 0.0826 158.31)",
          "primary-content": "oklch(100% 0 0)",
          "secondary": "oklch(76.87% 0.1234 184.97)",
          "secondary-focus": "oklch(65.73% 0.1053 185.22)",
          "secondary-content": "oklch(100% 0 0)",
          "accent": "oklch(64.79% 0.1726 249.75)",
          "accent-focus": "oklch(60.03% 0.1719 251.22)",
          "accent-content": "oklch(100% 0 0)",
          "neutral": "oklch(37.74% 0.0226 261.23)",
          "neutral-focus": "oklch(30.1% 0.0173 266.38)",
          "neutral-content": "oklch(100% 0 0)",
          "base-100": "oklch(100% 0 0)",
          "base-200": "oklch(98.46% 0.0017 247.84)",
          "base-300": "oklch(86.48% 0.0099 252.82)",
          "base-content": "oklch(27.02% 0.0275 257.53)",
          "info": "oklch(64.79% 0.1726 249.75)",
          "success": "oklch(59.82% 0.1068 182.47)",
          "warning": "oklch(77.2% 0.1737 64.55)",
          "error": "oklch(52.94% 0.2121 36.25)",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.25s",
          "--animation-input": "0.2s",
          "--btn-text-case": "uppercase",
          "--navbar-padding": "0.5rem",
          "--border-btn": "1px",
        },
      },
    ],
  },
}
