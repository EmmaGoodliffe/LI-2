const colors = require("tailwindcss/colors");

module.exports = {
  theme: {
    extend: {
      colors: {
        p: colors.cyan[500],
        s: colors.coolGray[700],
        w: colors.coolGray[200],
        "disabled-p": colors.cyan[800],
        "disabled-s": colors.coolGray[400],
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
