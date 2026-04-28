const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const outDir = path.resolve(__dirname, "./extension");
const scriptPath = path.resolve(__dirname, "./app/scripts/");

module.exports = {
  mode: "production",
  entry: {
    content: path.resolve(scriptPath, "./content"),
  },
  output: {
    path: outDir,
    filename: "[name]-script.js",
  },
  resolve: {
    extensions: [".ts", ".js", ".tsx"],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.resolve(outDir, "content-script.js"),
        path.resolve(outDir, "content-script.js.LICENSE.txt"),
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        options: {
          compilerOptions: {
            target: "es5",
            noEmit: false,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.tsx$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
            },
          },
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                target: "es5",
                noEmit: false,
              },
            },
          },
        ],
      },
    ],
  },
};
