/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0d0f14',
          800: '#13151c',
          700: '#1a1d27',
          600: '#21253a',
          500: '#2a2f47'
        },
        accent: {
          blue:   '#4f8ef7',
          green:  '#3ecf8e',
          yellow: '#f0b429',
          red:    '#f87171',
          purple: '#a78bfa',
          orange: '#fb923c',
          cyan:   '#22d3ee'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}

