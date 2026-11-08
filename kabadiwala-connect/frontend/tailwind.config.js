/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#0F3D2E', 600: '#0B2F23' },
        emerald: { DEFAULT: '#10B981' },
        accent: '#F5B700',
        surface: '#F5FAF6',
        ink: '#1F2A24',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'] },
      boxShadow: { soft: '0 4px 18px rgba(15,61,46,0.08)' },
    },
  },
  plugins: [],
};
