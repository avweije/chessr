const { addDynamicIconSelectors } = require("@iconify/tailwind");
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.{html,html.twig}", "./assets/js/**/*.js"],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        primary: colors.blue,
        secondary: colors.emerald,
        chestnut: {
          50: "#fcf5f4",
          100: "#fae8e6",
          200: "#f6d5d2",
          300: "#efb7b2",
          400: "#e48d85",
          500: "#d6675d",
          600: "#c4544a",
          700: "#a23c33",
          800: "#86352e",
          900: "#70322c",
          950: "#3c1613",
        },
        tacao: {
          50: "#fdf7ef",
          100: "#f9ebdb",
          200: "#f3d4b5",
          300: "#e8ae78",
          400: "#e19156",
          500: "#da7435",
          600: "#cc5c2a",
          700: "#a94725",
          800: "#883a24",
          900: "#6e3220",
          950: "#3b180f",
        },
      },
    },
  },
  plugins: [
    // Iconify plugin
    addDynamicIconSelectors(),
  ],
};
