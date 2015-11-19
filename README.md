# Connect Mustache Middleware

Connect middleware to compile requested html file as a mustache template before serving the response. Also allow mustache partials to be included using file system.

## Example

```js
var mustacheEngine = require('connect-mustache-middleware');

connect().use(mustacheEngine.middleware({
    rootDir: 'application/root/directory,
    dataDir: 'mock/data',
    templatePathOverides : null,
    datafileExt: '.json',
    templateExt: '.html',
    exclude: 'path/to/exclude',
    staticDataTypes: {
        CONFIG: 'config'
    }));

```

## Unit tests
 ```
 npm test
 ```


## Features
- Works as connect middleware and compile requested HTML file as mustache template.
- Allow mustache partials to be included using file system.
