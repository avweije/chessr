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
      },
    },
  },
  plugins: [
    // Iconify plugin
    addDynamicIconSelectors(),
  ],
};
