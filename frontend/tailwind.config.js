/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00f3ff',
          pink: '#ff00ff',
          purple: '#bc13fe',
          green: '#0aff00'
        },
        dark: {
          bg: '#050505',
          card: '#111111'
        }
      }
    },
  },
  plugins: [],
}
