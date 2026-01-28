/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#fafafa',
        card: '#18181b',
        'card-foreground': '#fafafa',
        primary: '#6366f1',
        'primary-foreground': '#fafafa',
        secondary: '#27272a',
        'secondary-foreground': '#fafafa',
        muted: '#27272a',
        'muted-foreground': '#a1a1aa',
        accent: '#27272a',
        'accent-foreground': '#fafafa',
        destructive: '#ef4444',
        'destructive-foreground': '#fafafa',
        border: '#27272a',
        input: '#27272a',
        ring: '#6366f1',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
