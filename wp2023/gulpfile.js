/*
 * plugin
 */
// require : settings
const { src, dest, watch, parallel, series } = require('gulp')
const $ = require('gulp-load-plugins')();

// require : scss
const plumber = require("gulp-plumber");
const notify = require('gulp-notify');
const sassGlob = require("gulp-sass-glob-use-forward");
const sass = require('gulp-sass');
const autoprefixer = require("gulp-autoprefixer");
sass.compiler = require("sass");
const fiber = require('fibers');

// require : js
const webpack = require('webpack');
const webpackStream = require('webpack-stream');

// require : images
const pngquant = require('imagemin-pngquant');
const mozjpeg = require('imagemin-mozjpeg');

// require : ローカルサーバー
const browserSync = require('browser-sync').create();

/*
 * tasks
 */
const TASK__scss = () => {
  return src( 'src/assets/scss/style.scss' )
    .pipe( plumber({ errorHandler: notify.onError( 'Error: <%= error.message %>' ) }) )
    .pipe( sassGlob() )
    .pipe( sass({
      fiber: fiber,
      outputStyle: "expanded"
    }) )
    .pipe( autoprefixer() )
    .pipe( dest( 'wp-content/themes/ichigo_world/assets/css' ) );
};

const TASK__css = () => {
  return src('wp-content/themes/ichigo_world/assets/css/style.css')
    .pipe( $.header('@charset "utf-8";\n') )
    .pipe( $.cleanCss() )
    .pipe( $.rename({ extname: '.min.css' }) )
    .pipe( dest( 'wp-content/themes/ichigo_world/assets/css' ) );
};

const TASK__imagemin = () => {
  return src('src/assets/images/**/*.{jpg,jpeg,png,gif,svg}')
    .pipe($.imagemin([
      pngquant({
        quality: [.65, .85],
        speed: 1
      }),
      mozjpeg({
        quality: 85,
        progressive: true
      })
    ]))
    .pipe(dest('wp-content/themes/ichigo_world/assets/images'));
};

const TASK__webpack = () => {
  return webpackStream({
    entry: './src/assets/js/script.js',
    output: {
      filename: 'bundle.js',
    },
  }, webpack)
  .pipe($.babel({presets: ['@babel/env']}))
  .pipe(dest('wp-content/themes/ichigo_world/assets/js'));
};

const TASK__minjs = () => {
  return src('wp-content/themes/ichigo_world/assets/js/bundle.js')
    .pipe($.uglify())
    .pipe($.rename({ suffix: '.min' }))
    .pipe(dest('wp-content/themes/ichigo_world/assets/js/'));
};

const browserSyncOption = {
  proxy: "http://localhost:8888/roseaupensant/gra/ichigo_world/",
  reloadOnRestart: true,
};

const sync = done => {
  browserSync.init(browserSyncOption);
  done();
}

const watchFiles = done => {
  const browserReload = () => {
    browserSync.reload();
    done();
  };
  watch('src/assets/scss/**/*.scss').on('change', series( parallel(series(TASK__scss, TASK__css)), browserReload));
  watch('src/assets/js/**/*.js').on('change', series( parallel(series(TASK__webpack, TASK__minjs)), browserReload));
  watch('wp-content/themes/ichigo_world/**/*.php').on('change', browserReload);
}

/*
 * scripts
 */
const scripts = parallel(
  series(TASK__scss, TASK__css),
  series(TASK__webpack, TASK__minjs),
  TASK__imagemin
);

exports.default = series( scripts, sync, watchFiles );
