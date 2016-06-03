/*eslint max-depth:0*/

'use strict';

/**
 * File: mustacheEngine.js
 * Description:
 * Connect middleware to compile requested html file as a mustache template before serving
 * the response. Also allows mustache partials to be included using file system.
 */

var fs = require('fs');
var Mustache = require('mustache');
var extend = require('extend');
var util = require('util');
var argv = require('yargs').argv;
var path = require('path');

var MustacheEngine = {

    /**
     * options
     * rootDir: ''
     * application basePath
     * dataDir: ''
     * location of mocked data
     * datafileExt: '.json'
     * file extension for mocked data files.
     * templateExt: '.html'
     * file extension for template files
     * exclude : ''
     * pattern for requests to be excluded (similar to RewriteCondition)
     */
    options: {
        rootDir: '',
        dataDir: '',
        templatePathOverides : '',
        datafileExt: '.json',
        templateExt: '.html',
        exclude: '',
        staticDataTypes: {}
    },

    staticData: {},

    regex: {
        partial: /\{{2,3}\s*\>\s[_-a-zA-Z0-9%@\/\.\|\s]*\}{2,3}/img,
        template: /[^_-a-zA-Z0-9%@\.\/\\]/img,
        placeHolder: /%s/img
    },

    partials: {},

    excludeFlags: ['NO_CACHE'],

    /**
     * setOptions
     * Set options for mustache engine
     * @param options
     */
    setOptions: function (options) {
        extend(this.options, options);
    },

    /**
     * setDefaults
     * Set defaults for mustache engine
     * @param defaults
     */
    setDefaults: function (defaults) {
        this.defaults = defaults;
    },

    /**
     * parseRequestHtml
     * Parse body html for include fragments and optional data to be rendered with
     * @param body
     * @returns {*}
     */
    parseRequestHtml: function (body) {

        var matches;

        // replace all appearance of partials ({{> file}}) with actual file contents
        matches = body.match(this.regex.partial) || [];

        if (matches) {
            for (var i = 0; i < matches.length; i++) {

                var match = this.removeMustacheSyntax(matches[i]);

                var parts = match.split('|');

                if (this.excludeFlagMatch(parts[parts.length - 1])) {
                    parts.pop();
                }

                this.partials[match] = {
                    data: JSON.parse(this.getPartialData(parts[1])) || null,
                    content: this.getPartialContent(parts[0], this.staticData.config)
                };
            }
        }

        // return template content
        return body;
    },

    /**
     * removeMustacheSyntax
     * @param text
     * @returns {*}
     */
    removeMustacheSyntax: function (text) {
        return text
            .replace(/\s/g, '')
            .replace(/\s*\}{2,3}/, '')
            .replace(/\s*\{{2,3}>/, '');
    },

    /**
     * excludeFlagMatch
     * @param text
     * @returns {boolean}
     */
    excludeFlagMatch: function (text) {
        return this.excludeFlags.indexOf(text) > -1;
    },

    /**
     * compileTemplates
     * Compile all templates with associated data or without data if none specified
     */
    compileTemplates: function () {

        var partial, content;

        for (var p in this.partials) {
            if (this.partials.hasOwnProperty(p)) {
                partial = this.partials[p];

                if (partial.data) {

                    for (var d in this.staticData) {
                        if (this.staticData.hasOwnProperty(d)) {
                            partial.data[d] = this.staticData[d];
                        }
                    }

                    content = Mustache.render(partial.content, partial.data);
                } else {
                    //compile with static data only
                    content = Mustache.render(partial.content, this.staticData);
                }

                this.partials[p].content = content;
            }
        }
    },

    /**
     * replacePartials
     * replace partial syntax with rendered templates
     * @param body
     * @returns {*}
     */
    replacePartials: function (body) {

        var matches;

        matches = body.match(this.regex.partial) || [];

        if (matches) {
            for (var i = 0; i < matches.length; i++) {
                body = body.replace(matches[i], this.partials[this.removeMustacheSyntax(matches[i])].content);
            }
        }

        return body;
    },
    /**
     * Function: getSiteName
     * @returns: string (site name ie. cfto)
     */
    getSiteName: function () {
        return argv.site ? argv.site : '';
    },

    /**
     * getPartialFile
     * @param fileName
     * @param config
     * Configuration object from this.staticData
     * @returns {string}
     */
    getPartialFile: function (fileName, config) {

        var fileContent = '',
            filePath = fileName,
            fileExist = true,
            fileOnPath = true;

        try {
            if (filePath.search(this.regex.placeHolder) >= 0) {
                filePath = util.format(fileName, config.channel);

                fileExist = fs.existsSync(this.options.rootDir + '/' + filePath);
            }

            fileOnPath = fs.existsSync(path.join(this.options.rootDir, this.getSiteName(), filePath));
            filePath = fileOnPath ? path.join(this.getSiteName(), filePath) : filePath;

            if (fileExist) {
                fileContent = fs.readFileSync(this.options.rootDir + '/' + filePath, 'utf8');
            }

        } catch (e) {
            throw new Error('Partial file not found: ' + filePath);
        }

        return fileContent;
    },

    /**
     * getPartialData
     * @param fileName {String}
     * @returns {*}
     */
    getPartialDataFile: function (fileName) {

        var fileContent;

        try {
            fileContent = fs.readFileSync(this.options.dataDir + '/' + fileName, 'utf8');
        } catch (e) {
            throw new Error('Data file not found: ' + fileName);
        }

        return fileContent;
    },

    /**
     * parsePartialFileName
     * @param identifier {String}
     * @returns {*}
     */
    parsePartialFileName: function (identifier) {

        var fileName = identifier.replace(this.regex.template, '');

        if (fileName.length) {
            fileName += this.options.templateExt;
        }

        return fileName;
    },

    /**
     * parsePartialDataFileName
     * @param identifier
     * @returns {*}
     */
    parsePartialDataFileName: function (identifier) {

        var fileName = this.removeMustacheSyntax(identifier);

        if (fileName.length) {
            fileName += this.options.datafileExt;
        }

        return fileName;
    },

    /**
     * getPartialFileContent
     * @param identifier {String}
     * @param config
     * Configuration object from this.staticData
     * @returns {*|string}
     */
    getPartialContent: function (identifier, config) {

        var fileName, content;

        fileName = this.parsePartialFileName(identifier);
        content = this.getPartialFile(fileName, config);

        return content;
    },

    /**
     * getPartialData
     * @param identifier {string}
     * @returns {*}
     */
    getPartialData: function (identifier) {

        var fileName;

        if (!identifier) {
            return false;
        }

        fileName = this.parsePartialDataFileName(identifier);

        return this.getPartialDataFile(fileName);
    },

    /**
     * includePartials
     */
    includePartials: function () {

        var matches,
            content;

        // replace all appearance of partials ({{> file}}) with actual file contents
        for (var p in this.partials) {

            if (this.partials.hasOwnProperty(p)) {
                content = this.partials[p].content;

                do {
                    matches = content.match(this.regex.partial) || [];

                    if (matches) {
                        for (var i = 0; i < matches.length; i++) {
                            content = content.replace(matches[i], this.getPartialContent(matches[i]), this.staticData.config);
                        }
                    }

                } while (matches && matches.length > 0);

                this.partials[p].content = content;
            }
        }
    },

    /**
     * getChannel
     * @param channel
     * @returns {*|string}
     */
    getChannel: function (channel) {
        return channel || this.defaults.CHANNEL.DEFAULT.toLowerCase();
    },

    /**
     * getPagePath
     * @param req
     * @returns {*}
     */
    getPagePath: function (req) {
        return req._parsedUrl.pathname.replace(/^\/|\/$/g, '');
    },

    /**
     * getPageParams
     * @param req
     * @returns {{}}
     */
    getPageParams: function (req) {

        var query = req._parsedUrl.query,
            returnParams = {};

        if (query) {
            var params = query.split('&');

            for (var i = 0; i < params.length; i++) {

                var splitParam = params[i].split('=');

                if (splitParam.length === 2) {
                    returnParams[splitParam[0]] = splitParam[1];
                }
            }
        }

        return returnParams;
    },

    /**
     * setStaticData
     * configures static data used by Mustache engine
     * @param channel
     * @param pagePath
     */
    setStaticData: function (channel, pagePath) {

        for (var t in this.options.staticDataTypes) {

            if (this.options.staticDataTypes.hasOwnProperty(t)) {

                var dataType = this.options.staticDataTypes[t];
                var setting = this.defaults.get(channel, dataType);

                this.staticData[dataType] = setting;

                if (dataType === this.options.staticDataTypes.CHECKOUT_HEADER) {
                    this.staticData[dataType] = setting[pagePath];

                }
            }
        }
    },

    /**
     * swapMappers
     * @param template
     * @param oldMapper
     * @param newMapper
     * @returns {*}
     *
     * replaces both references to the original mapper file,
     * and the escaped mapper file
     */
    swapMappers: function (template, oldMapper, newMapper) {

        var dataRegex = new RegExp('(\\b' + oldMapper + '\\b)'),
            mapperRegex = new RegExp('(\\b' + oldMapper + '_MAPPER\\b)');

        template = template.replace(dataRegex, newMapper);
        template = template.replace(mapperRegex, newMapper + '_MAPPER');

        return template;
    },

    /**
     * middleware
     * Connect middleware function to  compile requested file as mustache template before serving response.
     * @param options
     * key/value options settings for middleware
     * @param defaults
     * @returns {Function}
     */
    middleware: function (options, defaults) {

        this.setOptions(options);

        this.setDefaults(defaults);

        return function (req, res, next) {

            // Skip mustache rendering if the resource is in exclusions list
            var exclude = MustacheEngine.options.exclude;

            if (req.url.match(/\./) || (exclude && req.url.match(exclude))) {
                return next();
            }

            var pagePath = MustacheEngine.getPagePath(req);
            var pageParams = MustacheEngine.getPageParams(req);
            var channel = MustacheEngine.getChannel(pageParams.channel);

            MustacheEngine.setStaticData(channel, pagePath);

            var write = res.write,
                completeBody;

            res.write = function (chunk) {

                try {
                    var mustacheTemplate = chunk.toString();

                    if (pageParams.oldMapper && pageParams.newMapper) {
                        mustacheTemplate = MustacheEngine.swapMappers(mustacheTemplate, pageParams.oldMapper, pageParams.newMapper);
                    }

                    MustacheEngine.parseRequestHtml(mustacheTemplate);
                    MustacheEngine.includePartials();
                    MustacheEngine.compileTemplates();

                    completeBody = MustacheEngine.replacePartials(mustacheTemplate);

                    if (!res.headersSent) {
                        res.setHeader('Content-Length', completeBody.length);
                    }

                    return write.call(res, completeBody);
                } catch (e) {
                    if (!res.headersSent) {
                        res.writeHead(500, {'Content-Type': 'text/plain'});
                    }

                    process.stdout.write(e);
                    return write.call(res, e.message);
                }
            };

            next();
        };
    }
};

module.exports =  MustacheEngine;
