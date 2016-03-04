'use strict';

describe('MustacheEngine', function() {

    var assert = require('assert');
    var mustacheEngine = require('../index.js');
    var fs = require('fs');
    var body;

    describe('setOptions', function() {

        it('should extend default options if passed', function() {

            mustacheEngine.setOptions({
                rootDir: 'x',
                dataDir: 'y',
                datafileExt: '.json',
                templateExt: '.html',
                exclude : 'command'
            });

            assert.equal(mustacheEngine.options.rootDir, 'x');
            assert.equal(mustacheEngine.options.dataDir, 'y');
            assert.equal(mustacheEngine.options.datafileExt, '.json');
            assert.equal(mustacheEngine.options.templateExt, '.html');

            mustacheEngine.setOptions({
                rootDir: './test/demo/rootDir',
                dataDir: './test/demo/dataDir',
                datafileExt: '.json',
                templateExt: '.html',
                exclude : 'command'
            });

            assert.equal(mustacheEngine.options.datafileExt, '.json');
        });
    });

    describe('Method: parsePartialFileName', function() {

        it('should match string and return file path', function() {

            assert.equal(mustacheEngine.parsePartialFileName('views/content'), 'views/content.html');
            assert.equal(mustacheEngine.parsePartialFileName('views/content'), 'views/content.html');
            assert.equal(mustacheEngine.parsePartialFileName('content'), 'content.html');
            assert.equal(mustacheEngine.parsePartialFileName('content2'), 'content2.html');
            assert.equal(mustacheEngine.parsePartialFileName('**'), '');
        });
    });

    describe('Method: parsePartialDataFileName', function() {

        it('should match data and return JSON data filename', function() {

            assert.equal(mustacheEngine.parsePartialDataFileName('helloWorld'), 'helloWorld' + mustacheEngine.options.datafileExt);
            assert.equal(mustacheEngine.parsePartialDataFileName('}}'), '');
            assert.equal(mustacheEngine.parsePartialDataFileName('2}}'), '2' + mustacheEngine.options.datafileExt);
        });
    });

    describe('Method: parseRequestHtml', function() {

        it('should match data and return JSON data filename', function() {

            body = fs.readFileSync(mustacheEngine.options.rootDir + '/index.html', 'utf8');

            mustacheEngine.parseRequestHtml(body);

            assert.equal(mustacheEngine.partials['views/header|header'].data.headerData, 'HEADER SECTION DATA');
            assert.equal(mustacheEngine.partials['views/header|header'].content, '<h2>{{headerData}}</h2>');

            assert.equal(mustacheEngine.partials['views/content|content'].data.contentData, 'CONTENT SECTION DATA');
            assert.equal(mustacheEngine.partials['views/content|content'].content, '<h3>{{contentData}}</h3>\n{{> views/nested}}');

            assert.equal(mustacheEngine.partials['views/footer'].data, null);
            assert.equal(mustacheEngine.partials['views/footer'].content, '<h2>{{footerData}}</h2>');
        });
    });

    describe('Method: removeMustacheSyntax', function() {

        it('should remove mustache syntax from a string', function() {

            assert.equal(mustacheEngine.removeMustacheSyntax('{{> xyz}}'), 'xyz');
            assert.equal(mustacheEngine.removeMustacheSyntax('{{> xyz | abc}}'), 'xyz|abc');
            assert.equal(mustacheEngine.removeMustacheSyntax('{{> xyz | abc | NO_CACHE}}'), 'xyz|abc|NO_CACHE');
        });
    });

    describe('Method: includePartials', function() {
        it('should correctly include nested partials', function() {
            mustacheEngine.includePartials();
        });
    });

    describe('Method: compileTemplates', function() {

        it('should compile into the template if data is present', function() {
            mustacheEngine.compileTemplates();

            assert.equal(mustacheEngine.partials['views/content|content'].content, '<h3>CONTENT SECTION DATA</h3>\n<h4>NESTED SECTION DATA</h4>');
            assert.equal(mustacheEngine.partials['views/header|header'].content, '<h2>HEADER SECTION DATA</h2>');
            assert.equal(mustacheEngine.partials['views/footer'].content, '<h2></h2>');
        });
    });


    describe('Method: replacePartials', function() {

        it('should correctly replace partial syntax in html', function() {
            body = mustacheEngine.replacePartials(body);

            assert.equal(body, '<h1>index page</h1>\n<h2>HEADER SECTION DATA</h2>\n<h3>CONTENT SECTION DATA</h3>\n<h4>NESTED SECTION DATA</h4>\n<h2></h2>');
        });
    });

    describe('Method: excludeFlagMatch', function() {

        it('should correctly replace partial syntax in html if eclude flag is present', function() {
            mustacheEngine.excludeFlags = ['TEST_FLAG', 'OTHER_TEST_FLAG'];
            assert.equal(mustacheEngine.excludeFlagMatch('TEST_FLAG'), true);
            assert.equal(mustacheEngine.excludeFlagMatch('OTHER_TEST_FLAG'), true);
            assert.equal(mustacheEngine.excludeFlagMatch('SHOULDNT_EXIST'), false);
        });
    });
});