const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const outDir = path.resolve(__dirname, "./extension/weiboSave");
const scriptPath = path.resolve(__dirname, "./weiboSave/scripts/");

module.exports = {
  mode: "production",
  externals: {
    "./myblog.json": "myblog",
  },
  entry: {
    weibosave: path.resolve(scriptPath, "./weibosave"),
  },
  output: {
    path: outDir,
    filename: "scripts/[name].js",
  },
  resolve: {
    extensions: [".ts", ".js", ".tsx"],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.resolve(outDir, "index.html"),
        path.resolve(outDir, "scripts/*"),
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./weiboSave/index.html",
      filename: "index.html",
      minify: {
        collapseWhitespace: true,
        removeComments: true,
      },
      inject: false,
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
