/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E17',
        surface: '#0F1520',
        card: '#131A27',
        'card-alt': '#161D2B',
        'card-hover': '#1A2233',
        border: '#1C2536',
        'border-light': '#232D40',
        'text-primary': '#E2E8F0',
        'text-sec': '#A0AEC0',
        'text-dim': '#CBD5E0',
        accent: '#5B8DEF',
        'accent-muted': 'rgba(91,141,239,0.1)',
        pos: '#4AF6C3',
        neg: '#FF433D',
        price: '#F8A11E',
        'bbg-red': '#880F1D',
        'bbg-navy': '#031D38',
        'bbg-black': '#000000',
        'bbg-khaki': '#6b5a3a',
        gold: '#D4A957',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['Source Code Pro', 'monospace'],
      },
    },
  },
  plugins: [],
}
