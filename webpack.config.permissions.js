const path = require("path");

module.exports = {
  entry: "./scripts/permissions.ts",
  mode: "production",

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: { configFile: "tsconfig.scripts.json" },
        include: [
          path.resolve(__dirname, "src"),
          path.resolve(__dirname, "scripts/permissions.ts"),
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "permissions.js",
    path: path.resolve(__dirname, "dist"),
  },
};
