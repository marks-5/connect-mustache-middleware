/*
 File: mustacheEngine.js
 Description:
 Connect middleware to compile requested html file as a mustache template before serving
 the response. Also allows mustache partials to be included using file system.
 Options:
 rootDir: '', //application basePath
 dataDir: '''', //location of mocked data
 datafileExt: '.json', //file extension for mocked data files.
 templateExt: '.html', //file extension for template files
 exclude : '' //pattern for requests to be excluded (similar to RewriteCondition)
 */

var WritableStream = require("stream-buffers").WritableStreamBuffer;
var fs = require('fs');
var path = require('path');
var Mustache = require('mustache');
//var mustacheConfig = require('../../config/default/mustache');
var extend = require('extend');
//var defaults = require('../../mock/src/channel/defaults');
var util = require('util');

var MustacheEngine = {

    // options property
    options: {
        rootDir: '',
        dataDir: '',
        datafileExt: '.json',
        templateExt: '.html',
        exclude: '',
        staticDataTypes: {}
    },

    staticData: {},

    regex: {
        partial: /\{{2,3}\s*\>\s[_-a-zA-Z0-9%\/\.\|\s]*\}{2,3}/img,
        template: /[^a-zA-Z0-9%\.\/\\]/img,
        placeHolder: /%s/img
    },

    partials: {},

    excludeFlags : ['NO_CACHE'],

    /*
     Function: setOptions
     Set options for mustache engine
     Params:
     - options: key/value options
     Returns: NA
     */
    setOptions: function (options) {
        extend(this.options, options);
    },

    /*
     Function: parseRequestHtml
     Parse body html for include fragments and
     optional data to be rendered with
     Params:
     - body: HTML string
     Returns: string
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

    removeMustacheSyntax : function (text) {
        return text
            .replace(/\s/g, '')
            .replace(/\s*\}{2,3}/, '')
            .replace(/\s*\{{2,3}>/, '');
    },

    excludeFlagMatch : function (text) {
        return this.excludeFlags.indexOf(text) > -1;
    },

    /*
     Function: compileTemplates
     Compile all templates with associated data or without data if none specified
     Returns: NA
     */
    compileTemplates: function () {

        var partial, content;

        for (var p in this.partials) {

            partial = this.partials[p];

            if (partial.data) {

                for (var d in this.staticData) {
                    partial.data[d] = this.staticData[d];
                }

                content = Mustache.render(partial.content, partial.data);
            } else {
                //compile with static data only
                content = Mustache.render(partial.content, this.staticData);
            }

            this.partials[p].content = content;
        }
    },

    /*
     Function: replacePartials
     replace partial syntax with rendered templates
     Params:
     - body: HTML string
     Returns: string
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

    /*
     Function: getPartialFileContent
     Params:
     - fileName: string
     - config: Configuration object from this.staticData
     Returns: string
     */
    getPartialFile: function (fileName, config) {

        var fileContent = '',
            path = fileName,
            fileExist = true;

        try {

            if (path.search(this.regex.placeHolder) >= 0) {
                path = util.format(fileName, config.channel);

                fileExist = fs.existsSync(this.options.rootDir + '/' + path);
            }

            if (fileExist) {
                fileContent = fs.readFileSync(this.options.rootDir + '/' + path, 'utf8');
            }

        } catch (e) {
            throw new Error('Partial file not found: ' + path);
        }

        return fileContent;
    },

    /*
     Function: getPartialData
     Params:
     - fileName: string
     Returns: JSON string
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

    /*
     Function: parsePartialFileName
     Params:
     - identifier: string
     Returns: string
     */
    parsePartialFileName: function (identifier) {

        var fileName = identifier.replace(this.regex.template, '');

        if (fileName.length) {
            fileName += this.options.templateExt;
        }

        return fileName;
    },

    /*
     Function: parsePartialDataFileName
     Params:
     - identifier: string
     Returns: string
     */
    parsePartialDataFileName: function (identifier) {

        var fileName = this.removeMustacheSyntax(identifier);

        if (fileName.length) {
            fileName += this.options.datafileExt;
        }

        return fileName;
    },

    /*
     Function: getPartialFileContent
     Params:
     - identifier: string
     - config: Configuration object from this.staticData
     Returns: string
     */
    getPartialContent: function (identifier, config) {

        var fileName, content;

        fileName = this.parsePartialFileName(identifier);
        content = this.getPartialFile(fileName, config);

        return content;
    },

    /*
     Function: getPartialData
     Params:
     - identifier: string
     Returns: JSON string
     */
    getPartialData: function (identifier) {

        var fileName;

        if (!identifier) return false;

        fileName = this.parsePartialDataFileName(identifier);

        return this.getPartialDataFile(fileName);
    },

    /*
     Function: includePartials
     Returns main Mustache template by including all partials mentioned in the HTML content
     Params:
     - body: HTML content contains partials syntax to include other files.
     Returns: Mustache Template
     */
    includePartials: function () {

        var matches,
            content;

        // replace all appearance of partials ({{> file}}) with actual file contents
        for (var p in this.partials) {

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
    },

    /*
     Function: getChannel
     Gets the query string value for channel
     Params:
     - query: connect middleware query string
     Returns: 'default' value if query string param not present or param value does not match defaults.CHANNEL else param value
     */
    getChannel: function (query) {
        var value = (query['channel'] || defaults.CHANNEL.DEFAULT).toLowerCase();

        if (value !== defaults.CHANNEL.DEFAULT && value !== defaults.CHANNEL.TSOP && value !== defaults.CHANNEL.BUSER) {
            value = defaults.CHANNEL.DEFAULT;
        }

        return value;
    },

    /*
     Function: getChannel
     Gets page path of request
     Params:
     - req: express req
     Returns: pathname from express req.
     */
    getPagePath: function (req) {
        return req._parsedUrl.pathname.replace(/^\/|\/$/g, '');
    },

    /*
     Function: setStaticData
     configures static data used by Mustache engine
     Params:
     - channel: channel type
     Returns: N/A
     */
    setStaticData: function (channel, pagePath) {
        for (var t in this.options.staticDataTypes) {
            var dataType = this.options.staticDataTypes[t];
            var setting = defaults.get(channel, dataType);

            this.staticData[dataType] = setting;

            if(dataType === mustacheConfig.staticDataTypes.CHECKOUT_HEADER) {
                this.staticData[dataType] = setting[pagePath];
            }
        }
    },

    /*
     Function: middleware
     Connect middleware function to  compile requested file as mustache template before serving response.
     Params:
     - options: key/value options settings for middleware
     Returns: NA
     */
    middleware: function (options) {

        this.setOptions(options);

        return function (req, res, next) {

            // Skip mustache rendering if the resource is in exclusions list
            if (req.url.match(/\./) || req.url.match(MustacheEngine.options.exclude)) {
                return next();
            }

            var channel = MustacheEngine.getChannel(req.query);
            var pagePath = MustacheEngine.getPagePath(req);

            MustacheEngine.setStaticData(channel, pagePath);

            var write = res.write,
                completeBody;

            res.write = function (chunk) {

              try {
                var mustacheTemplate = chunk.toString();

                MustacheEngine.parseRequestHtml(mustacheTemplate);
                MustacheEngine.includePartials();
                MustacheEngine.compileTemplates();

                completeBody = MustacheEngine.replacePartials(mustacheTemplate);

                if (!res.headersSent) {
                    res.setHeader('Content-Length', completeBody.length);
                }

                return write.call(res, completeBody);
              } catch(e) {
                if (!res.headersSent) {
                  res.writeHead(500, {'Content-Type': 'text/plain'});
                }

                console.dir(e);
                return write.call(res, e.message);
              }
            };

            next();
        }
    }
};

module.exports = exports = MustacheEngine;
