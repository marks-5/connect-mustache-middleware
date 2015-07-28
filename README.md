# Connect Mustache Middleware

Connect middleware to compile requested html file as a mustache template before serving the response. Also allow mustache partials to be included using file system.

## Example

```js
var mustacheEngine = require('./lib/mustache-engine/mustacheEngine.js');

connect().use(mustacheEngine.middleware({
	rootDir: '.tmp', // path to look mustache templates
	dataDir: 'mock/data' // path to look for JSON data files
}))

```

## Installation
Currently its not a published node module so we need to include it using require() call.

var mustacheEngine = require('./lib/mustache-engine/mustacheEngine.js');


## Features
- Works as connect middleware and compile requested HTML file as mustache template.
- Allow mustache partials to be included using file system.