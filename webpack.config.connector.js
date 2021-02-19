const path = require("path");

module.exports = {
  entry: "./scripts/connector.ts",
  mode: "production",

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: { configFile: "tsconfig.scripts.json" },
        include: [
          path.resolve(__dirname, "src"),
          path.resolve(__dirname, "scripts/connector.ts"),
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "connector.js",
    path: path.resolve(__dirname, "dist"),
  },
};
