/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ds: {
          bg: '#f6f7f9',
          panel: '#ffffff',
          border: '#e4e6eb',
          text: '#1f2329',
          sub: '#8a919f',
          brand: '#4d6bfe',
          brandDark: '#3a55e0',
          hover: '#eef1f6'
        },
        dsdark: {
          bg: '#1b1c1e',
          panel: '#232427',
          border: '#34363a',
          text: '#e8eaed',
          sub: '#9aa0a6',
          brand: '#5b78ff',
          brandDark: '#4a63e8',
          hover: '#2c2e33'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Microsoft YaHei',
          'PingFang SC',
          'sans-serif'
        ]
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-in': 'slideIn 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 6px 24px rgba(77,107,254,0.35)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 8px 30px rgba(77,107,254,0.55)' }
        }
      }
    }
  },
  plugins: []
}
