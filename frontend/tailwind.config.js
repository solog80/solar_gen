/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkbg: '#0b0f17',
        cardbg: 'rgba(22, 28, 40, 0.8)',
        cardborder: 'rgba(255, 255, 255, 0.08)',
        solaramber: '#f59e0b',
        batteryemerald: '#10b981',
        loadcyan: '#06b6d4',
        gridpurple: '#8b5cf6',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace'],
      },
    },
  },
  plugins: [],
}
