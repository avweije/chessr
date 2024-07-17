const Encore = require("@symfony/webpack-encore");
const { ChildProcess } = require("child_process");

// Webpack config for development
var fs = require("fs");
var path = require("path");

// Manually configure the runtime environment if not already configured yet by the "encore" command.
// It's useful when you use tools that rely on webpack.config.js file.
if (!Encore.isRuntimeEnvironmentConfigured()) {
  Encore.configureRuntimeEnvironment(process.env.NODE_ENV || "dev");
}

Encore
  // directory where compiled assets will be stored
  .setOutputPath("public/build/")
  // public path used by the web server to access the output path
  .setPublicPath("/build")
  // only needed for CDN's or subdirectory deploy
  //.setManifestKeyPrefix('build/')

  /*
   * ENTRY CONFIG
   *
   * Each entry will result in one JavaScript file (e.g. app.js)
   * and one CSS file (e.g. app.css) if your JavaScript imports CSS.
   */
  .addEntry("app", "./assets/app.js")
  .addEntry("modal", "./assets/js/modal.js")
  .addEntry("chessboard", "./assets/js/chessboard.js")
  .addEntry("repertoire", "./assets/js/repertoire.js")
  .addEntry("practice", "./assets/js/practice.js")
  .addEntry("analyse", "./assets/js/analyse.js")

  .addStyleEntry("markers", "./assets/markers/markers.css")

  // When enabled, Webpack "splits" your files into smaller pieces for greater optimization.
  .splitEntryChunks()

  // will require an extra script tag for runtime.js
  // but, you probably want this, unless you're building a single-page app
  .enableSingleRuntimeChunk()

  /*
   * FEATURE CONFIG
   *
   * Enable & configure other features below. For a full
   * list of features, see:
   * https://symfony.com/doc/current/frontend.html#adding-more-features
   */
  .cleanupOutputBeforeBuild()
  .enableBuildNotifications()
  .enableSourceMaps(!Encore.isProduction())
  // enables hashed filenames (e.g. app.abc123.css)
  .enableVersioning(Encore.isProduction())

  // configure Babel
  // .configureBabel((config) => {
  //     config.plugins.push('@babel/a-babel-plugin');
  // })

  // enables and configure @babel/preset-env polyfills
  .configureBabelPresetEnv((config) => {
    config.useBuiltIns = "usage";
    config.corejs = "3.23";
  })

  // enables Sass/SCSS support
  //.enableSassLoader()

  // uncomment if you use TypeScript
  .enableTypeScriptLoader()

  // uncomment if you use React
  //.enableReactPreset()

  // uncomment to get integrity="..." attributes on your script & link tags
  // requires WebpackEncoreBundle 1.4 or higher
  //.enableIntegrityHashes(Encore.isProduction())

  // uncomment if you're having problems with a jQuery plugin
  //.autoProvidejQuery()

  .enablePostCssLoader((options) => {
    options.postcssOptions = {
      config: "./postcss.config.js",
    };
  })

  .copyFiles({
    from: "./assets/images",
    to: "images/[path][name].[ext]",
    pattern: /\.(png|jpg|jpeg)$/,
  })

  .copyFiles({
    from: "./assets/pieces",
    to: "pieces/[name].[ext]",
    pattern: /\.(svg)$/,
  })

  .copyFiles({
    from: "./assets/markers",
    to: "extensions/markers/[name].[ext]",
    pattern: /\.(svg)$/,
  })

  .copyFiles({
    from: "./assets/uploads",
    to: "uploads/[name].[ext]",
    pattern: /\.(pgn)$/,
  })

  .copyFiles({
    from: "./assets/stockfish",
    to: "stockfish/[name].[ext]",
    pattern: /\.(exe)$/,
  });

module.exports = Encore.getWebpackConfig();
