/*eslint max-depth:0*/

'use strict';

/**
 * @module mustacheEngine
 * @description Connect middleware to compile requested html file as a mustache template before serving
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
     *
     * @property rootDir
     * @default []
     * @description application basePath
     *
     * @property dataDir
     * @default ''
     * @description location of mocked data
     *
     * @property datafileExt
     * @default '.json'
     * @description file extension for mocked data files.
     *
     * @property templateExt
     * @default '.html'
     * @description file extension for template files
     *
     * @property exclude
     * @default ''
     * @description pattern for requests to be excluded (similar to RewriteCondition)
     */
    options: {
        rootDir: [],
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
     * @description Set options for mustache engine
     * @param options
     */
    setOptions: function (options) {
        extend(this.options, options);
    },

    /**
     * setDefaults
     * @description Set defaults for mustache engine
     * @param defaults
     */
    setDefaults: function (defaults) {
        this.defaults = defaults;
    },

    /**
     * parseRequestHtml
     * @description Parse body html for include fragments and optional data to be rendered with
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
                    data: this.getPartialData(parts[1]),
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
     * @description Compile all templates with associated data or without data if none specified
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
     * @description replace partial syntax with rendered templates
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
     * getSiteName
     * @returns: string (site name ie. cfto)
     */
    getSiteName: function () {
        return argv.site ? argv.site : '';
    },

    /**
     * getPartialFile
     * @description if template exists for specified site then use that else use default and return the file content
     * @param fileName
     * @param channel
     * @returns {string}
     */
    getPartialFile: function (fileName, channel) {

        var fileContent = '';
        var file;
        var siteFile = this.getSiteFilePath(fileName, channel);

        file = this.fileExistsOnPath(siteFile.path, this.getRootDir()[0])
            ? siteFile
            : this.getDefaultFilePath(fileName, channel);

        try {
            fileContent = this.readFileContent(file.path, file.root, 'utf8');
        } catch (e) {
            throw e;
        }

        return fileContent;
    },

    /**
     * getRootDir
     * @returns {Array}
     */
    getRootDir: function () {
        return Array.isArray(this.options.rootDir) ? this.options.rootDir : [this.options.rootDir];
    },

    /**
     * getDefaultFilePath
     * @description will iterate through rootDir property until a match is found
     * @param fileName
     * @param channel
     * @returns {*}
     */
    getDefaultFilePath: function (fileName, channel) {

        var filePath;

        var roots = this.getRootDir();

        for (var path in roots) {
            if (roots.hasOwnProperty(path)) {

                filePath = this.replacePathParameters(fileName);

                if (this.fileExistsOnPath(filePath, roots[path])) {

                    filePath = this.replacePlaceHolderInPath(filePath, channel);

                    return {
                        path: filePath,
                        root: roots[path]
                    };
                }
            }
        }
    },

    /**
     * getSiteFilePath
     * @param fileName
     * @param channel
     * @returns {string|*}
     */
    getSiteFilePath: function (fileName, channel) {

        var filePath = this.replacePathParameters(this.replacePlaceHolderInPath(fileName, channel));

        return {
            path: path.join(this.getSiteName(), filePath),
            root: this.getRootDir()[0]
        };
    },

    /**
     * replacePlaceHolderInPath
     * @param fileName
     * @param toReplace
     * @returns {*}
     */
    replacePlaceHolderInPath: function(fileName, toReplace) {

        if (fileName.search(this.regex.placeHolder) >= 0) {
            fileName = util.format(fileName, toReplace);
        }

        return fileName;
    },

    /**
     * replacePathParameters
     * @param filePath {String}
     * @returns {*}
     */
    replacePathParameters: function(filePath) {
        for (var p in this.placeHolders) {
            if (this.placeHolders.hasOwnProperty(p)) {
                if (filePath.search('/%' + p + '/') >= 0) {
                    filePath = filePath.replace('%' + p, this.placeHolders[p]);
                }
            }
        }

        return filePath;
    },

    /**
     * readFileContent
     * @param filePath
     * @param encoding
     * @returns {*}
     */
    readFileContent: function (filePath, root, encoding) {
        return fs.readFileSync(path.join(root, filePath), encoding);
    },

    /**
     * fileExistsOnPath
     * @param filePath
     * @param root
     * @returns {*}
     */
    fileExistsOnPath: function (filePath, root) {
        return fs.existsSync(path.join(root, filePath));
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
     * @description Configuration object from this.staticData
     * @returns {*|string}
     */
    getPartialContent: function (identifier, config) {

        var fileName, content;
        var channel = config ? config.channel : '';

        fileName = this.parsePartialFileName(identifier);
        content = this.getPartialFile(fileName, channel);

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
            return null;
        }

        fileName = this.parsePartialDataFileName(identifier);

        return JSON.parse(this.getPartialDataFile(fileName));
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
     * @description configures static data used by Mustache engine
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
     * setPlaceHolders
     * @param placeHolders
     */
    setPlaceHolders : function (placeHolders) {
        this.placeHolders = placeHolders;
    },

    /**
     * middleware
     * @description Connect middleware function to  compile requested file as mustache template before serving response.
     * @param options
     * @description key/value options settings for middleware
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

            //set placeholders for partial path replacement
            MustacheEngine.setPlaceHolders(pageParams);

            MustacheEngine.setStaticData(channel, pagePath);

            var write = res.write,
                completeBody;

            res.write = function (chunk) {

                try {
                    var mustacheTemplate = chunk.toString();

                    if (pageParams.oldMapper && pageParams.newMapper) {
                        mustacheTemplate = MustacheEngine.swapMappers(
                            mustacheTemplate,
                            pageParams.oldMapper,
                            pageParams.newMapper
                        );
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
