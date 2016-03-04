'use strict';

'use strict';

var gulp = require('gulp');
var ui = require('fear-core-ui');
var tasks = require('fear-core-build');

var autoPrefixOptions = {
    browsers: ['last 20 version', 'Explorer >= 8', 'Android >= 2'],
    cascade: false
};

var toProcess = {
    sources : [],
    destinations : []
};

toProcess.sources.push('docs/module/assets/sass/**/*.scss');
toProcess.destinations.push('docs/module/assets/css');

gulp.task('compile-sass', tasks.sass.compile(
    toProcess.sources,
    autoPrefixOptions,
    toProcess.destinations,
    ui.sassPaths
));
