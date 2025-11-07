/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores corporativos Partequipos
        brand: {
          red: '#cf1b22',      // Rojo corporativo principal
          gray: '#50504f',     // Gris medio corporativo
          white: '#FFFFFF',    // Blanco
        },
        // Alias para facilitar el uso
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a6',
          400: '#f87171',
          500: '#cf1b22',      // Rojo corporativo
          600: '#b71820',
          700: '#9f151c',
          800: '#871318',
          900: '#6f1014',
        },
        secondary: {
          50: '#f9f9f9',
          100: '#f3f3f3',
          200: '#e7e7e7',
          300: '#d1d1d1',
          400: '#b0b0b0',
          500: '#50504f',      // Gris corporativo
          600: '#484847',
          700: '#3f3f3e',
          800: '#363635',
          900: '#2d2d2c',
        },
      },
    },
  },
  plugins: [],
};
