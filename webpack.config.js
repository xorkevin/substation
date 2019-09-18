const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const createConfig = (env, argv) => {
  const config = {
    target: "web",
    entry: {
      main: ["core-js/stable", "main.js"]
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  };

  return config;
};

module.exports = createConfig;
