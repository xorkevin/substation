const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const createConfig = (env, argv) => {
  const config = {
    target: "web",
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  };

  return config;
};

module.exports = createConfig;
