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

// require : del
const del = require('del');

// json読み込み用
const fs = require('fs');

// htmlの自動整形
const htmlbeautify = require("gulp-html-beautify");

/*
 * env
 */
const minimist = require('minimist');
const envOption = {
  string: 'env',
  default: {
    env: process.env.NODE_ENV || 'development', // NODE_ENVに指定がなければ開発モードをデフォルトにする
  }
};
const options = minimist(process.argv.slice(2), envOption);
const isProduction = (options.env === 'production') ? true : false;
console.log('[build env]', options.env, '[is production]', isProduction);

const argv = require('minimist')(process.argv.slice(2));
console.dir(argv);

/*
 * config
 */
const config = {
  development: { // 開発用
    root: 'dist',
    path: {
      absolute: 'http://localhost:3000',
      relative: '/',
    }
  },
  production : { // 公開用
    root: 'prod',
    path: {
      absolute: 'http://localhost:3000',
      relative: '/',
    }
  }
};

/*
 * tasks
 */
const TASK__scss = () => {
  return src( './src/assets/scss/style.scss' )
    .pipe( plumber({ errorHandler: notify.onError( 'Error: <%= error.message %>' ) }) )
    .pipe( sassGlob() )
    .pipe( sass({
      fiber: fiber,
      outputStyle: "expanded"
    }) )
    .pipe( autoprefixer() )
    .pipe( dest( `${config[options.env].root}/assets/css` ) );
};

const TASK__css = () => {
  return src(`./${config[options.env].root}/assets/css/style.css`)
    .pipe( $.header('@charset "utf-8";\n') )
    .pipe( $.cleanCss() )
    .pipe( $.rename({ extname: '.min.css' }) )
    .pipe( dest( `${config[options.env].root}/assets/css` ) );
};

const TASK__ejs = () => {
  const json = JSON.parse(fs.readFileSync('./src/ejs/data.json'));
  return src('./src/ejs/**/[^_]*.ejs')
    .pipe($.plumber({
        handleError: (err) => {
            this.emit('end');
        }
    }))
    .pipe($.data(file => {
      const path = config[options.env].path
      return { path }
    }))
    .pipe($.ejs(json, {'ext': '.html'}))
    .pipe(
      htmlbeautify({
        indent_size: 2, //インデントサイズ
        indent_char: " ", // インデントに使う文字列はスペース1こ
        max_preserve_newlines: 0, // 許容する連続改行数
        preserve_newlines: false, //コンパイル前のコードの改行
        indent_inner_html: false, //head,bodyをインデント
        extra_liners: [], // 終了タグの前に改行を入れるタグ。配列で指定。head,body,htmlにはデフォで改行を入れたくない場合は[]。
      })
    )
    .pipe($.rename({extname: '.html'}))
    .pipe(dest(`./${config[options.env].root}`));
};

const TASK__inc = (done) => {
  return !isProduction ? done() : src('./src/ejs/play/**/!(panel)*.ejs')
    .pipe($.plumber({
        handleError: (err) => {
            this.emit('end');
        }
    }))
    .pipe($.data(file => {
      const path = config[options.env].path
      return { path }
    }))
    .pipe($.ejs())
    .pipe($.rename({extname: '.inc'}))
    .pipe(dest(`./${config[options.env].root}`));
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
    .pipe(dest(`${config[options.env].root}/assets/images`));
};

const TASK__webpack = () => {
  return webpackStream({
    entry: './src/assets/js/script.js',
    output: {
      filename: 'bundle.js',
    },
  }, webpack)
  .pipe($.babel({presets: ['@babel/env']}))
  .pipe(dest(`${config[options.env].root}/assets/js`));
};

const TASK__minjs = () => {
  return src(`${config[options.env].root}/assets/js/bundle.js`)
    .pipe($.uglify())
    .pipe($.rename({ suffix: '.min' }))
    .pipe(dest(`${config[options.env].root}/assets/js/`));
};

const TASK__json = () => {
  return src('./src/data/**/*.json')
    .pipe($.jsonminify())
    .pipe(dest(`${config[options.env].root}/data/`));
};

/*
 * browserSync
 */
const browserSyncOption = {
  server: {
    baseDir: config[options.env].root
  },
  middleware: [
    function(req, res, next) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    }
  ],
  reloadOnRestart: true
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
  watch('src/assets/scss/**/*.scss').on('change', series( parallel(series(TASK__scss, TASK__css)), browserReload ));
  watch('src/ejs/**/*.ejs').on('change',   series( parallel(series(TASK__ejs, TASK__inc)), browserReload ));
  watch('src/assets/js/**/*.js').on('change',     series( parallel(series(TASK__webpack, TASK__minjs)), browserReload ));
  watch('src/assets/data/**/*.json').on('change', series( TASK__json, browserReload ));
}
/*
 * clean
 */
const TASK__clean = () => {
  return process.env.NODE_ENV === 'production' ? del('prod/*') : del('dist/*');
};

/*
 * scripts
 */
const scripts = parallel(
  series(TASK__scss, TASK__css),
  series(TASK__ejs, TASK__inc),
  series(TASK__webpack, TASK__minjs),
  TASK__json, TASK__imagemin
);

exports.default = series( scripts, sync, watchFiles );
exports.build = series( TASK__clean, scripts );
