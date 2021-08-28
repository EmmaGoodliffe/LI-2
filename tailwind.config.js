const colors = require("tailwindcss/colors");

module.exports = {
  theme: {
    extend: {
      colors: {
        bg: colors.coolGray[800],
        p: colors.cyan[500],
        s: colors.coolGray[700],
        "dark-p": colors.cyan[800],
        "dark-s": colors.coolGray[400],
        "light-s": colors.coolGray[200],
        good: colors.green[500],
        bad: colors.red[500],
      },
      transitionDuration: {
        long: "700ms",
        short: "400ms",
      },
    },
  },
  variants: {},
  plugins: [],
};
