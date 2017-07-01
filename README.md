# traffic-accidents-taiwan

Node.js module to fetch and parse traffic accidents data for Taiwan.

這個 Node.js 模組讓你可以從最棒棒的中央氣象局取得全台灣天氣資料。

[![NPM](https://nodei.co/npm/traffic-accidents-taiwan.png)](https://nodei.co/npm/traffic-accidents-taiwan/)

## Installation

Install via NPM:
```
npm install traffic-accidents-taiwan 
```

## Usage

```js
var taTW = require('traffic-accidents-taiwan');

// Fetching raw data with specific URL
var fetcher = taTW.fetch('<URL>');

// Creating a parser to convert raw data to JavaScript object
var parser = taTW.parse();

parser.on('data', function(data) {
    console.log(data);
});

fetcher.pipe(parser);
```

### Support Stream and Pipe

Here is an example to use stream/pipe to convert data and output string to a file.

```js
var fs = require('fs');
var taTW = require('traffic-accidents-taiwan');

taTW
    .fetch('<URL>')
    .pipe(taTW.parse({ outputString: true }))
    .pipe(fs.createWriteStream('ta.json'));
```

License
-
Licensed under the MIT License

Authors
-
Copyright(c) 2017 Fred Chien <<cfsghost@gmail.com>>
