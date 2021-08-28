const colors = require("tailwindcss/colors");

module.exports = {
  theme: {
    extend: {
      colors: {
        p: colors.cyan[500],
        s: colors.coolGray[700],
        "dark-p": colors.cyan[800],
        "dark-s": colors.coolGray[400],
        "light-s": colors.coolGray[200],
        cyan: colors.cyan,
        good: colors.green[500],
        bad: colors.red[500],
        bg: colors.coolGray[800],
        cg: colors.coolGray,
      },
    },
  },
  variants: {},
  plugins: [],
};
