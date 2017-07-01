var sscanf = require('scanf').sscanf;
var moment = require('moment');
var Transform = require('stream').Transform;
var util = require('util');

var parseLocation = function(loc, skipRule) {

	let prefixes = [
		[
			/[\u4e00-\u9fa50-9]{1,2}?縣[\u4e00-\u9fa50-9]{1,2}?市+/g,
			/[\u4e00-\u9fa50-9]{1,2}?縣/g,
			/[\u4e00-\u9fa50-9]{1,2}?市/g
		],
		[
			/[\u4e00-\u9fa50-9]{1,3}?鎮/g,
			/[\u4e00-\u9fa50-9]{1,3}?鄉/g
		],
		/^(?!(.+路.+村)|(.+區.+村)|(.+里.+村)).+村/g,
		/((?!轄).{1})區/g,
		/((?!公).{1})里/g,
		[
			[
				/[\u4e00-\u9fa5]{1,6}?路/g,
				/[\u4e00-\u9fa5]{1,6}?路((?=一|二|三|四|五|六|七|八|九|十).{1})段/g,
				/[\u4e00-\u9fa5]{1,6}?路[0-9]{1,4}巷/g,
				/[\u4e00-\u9fa5]{1,6}?路*((?=一|二|三|四|五|六|七|八|九|十).{1})?巷/g,
				/[\u4e00-\u9fa5]{1,6}?路((?=一|二|三|四|五|六|七|八|九|十).{1})段[0-9]{1,4}巷/g,
				/[\u4e00-\u9fa5]{1,6}?路[0-9]{1,4}巷[0-9]{1,4}弄/g,
				/[\u4e00-\u9fa5]{1,6}?路((?=一|二|三|四|五|六|七|八|九|十).{1})段[0-9]{1,4}巷[0-9]{1,4}弄/g,
			],
			[
				/[\u4e00-\u9fa5]{1,5}?((?=大).{1})道/g,
				/[\u4e00-\u9fa5]{1,5}?大道((?=一|二|三|四|五|六|七|八|九|十).{1})段/g,
				/((?=大).{1})道[0-9]{1,4}巷/g,
				/[\u4e00-\u9fa5]{1,5}?大道((?=一|二|三|四|五|六|七|八|九|十).{1})段[0-9]{1,4}巷/g,
				/[\u4e00-\u9fa5]{1,5}?大道[0-9]{1,4}巷[0-9]{1,4}弄/g,
				/[\u4e00-\u9fa5]{1,5}?大道((?=一|二|三|四|五|六|七|八|九|十).{1})段[0-9]{1,4}巷[0-9]{1,4}弄/g,
			],
			[
				/((?=甲|乙).{1})線/g,
				/台[0-9]{1,3}線/g,
				/台((?=一|二|三|四|五|六|七|八|九|十).{1})線/g,
				/[0-9]{1,3}線/g,
				/[0-9]{1,3}線道/g
			],
			/((?!段|板).{1})橋/g,
			/((?!路|段|巷|道|橋|弄|號).{1}).?街/g,
			/((?=省).{1})道/g,
			/國道.{1,2}號/g,
		],
		[
			/[0-9]{1,5}號路燈/g,
			/[0-9]{1,5}號電桿/g,
			/[0-9]{1,5}號電線桿/g,
			/[0-9]{1,5}號電燈桿/g,
			/[0-9]{1,5}號/g,
		],
		[
			/[0-9]{1,3}公里處/g,
			/[0-9]{1,3}公里[0-9]{1,3}公尺處/g,
			/處/g
		]
	];

	var discovery = function(_loc, prefix, _pos) {

		if (prefix === undefined)
			return null;

		let loc = _loc;
		let pos = _pos;

		if (prefix instanceof Array) {

			let found = false;
			let result = null;
			for (var index = 0; index < prefix.length; index++) {
				var p = prefix[index];
				var ret = discovery(loc, prefix[index], pos)
				if (ret !== null) {
					found = true;

					if (result === null) {
						result = ret;
					} else if (result.index === ret.index && result.len < ret.len) {
						result = ret;
					} else if (result.index > ret.index) {
						result = ret;
					}
				}
			}

			if (found)
				return result;
		} else {

			let loc = _loc.substring(_pos);
			let pos = 0;

			var re = new RegExp(prefix);
			re.lastIndex = pos;

			var ret = re.exec(loc);
//			console.log(loc, prefix, pos, ret);
			if (ret !== null) {
				/*
				if (ret.index !== pos) {
					return null;
				}
*/
				return {
					len: ret[0].length,
					index: ret.index,
					end: _pos + ret.index + ret[0].length - 1
				};
			}

		}

		return null;
	};

	let geoParts = [];
	let prefixPos = 0;
	for (var index = skipRule || 0; index < prefixes.length; index++) {

		let ret = discovery(loc, prefixes[index], prefixPos);
//		console.log(loc, prefixes[index], prefixPos, _pos);
		if (ret !== null) {

			geoParts.push({
				start: prefixPos,
				end: ret.end + 1
			});
			prefixPos = ret.end + 1;
		}
	}

	if (prefixPos < loc.length) {
		geoParts.push({
			start: prefixPos,
			end: loc.length
		});
	}

	geoParts.reduce(function(prev, part) {

		if (prev === null) {
			return part;
		}
//console.log(part, prev, loc[part.end - 1], loc[prev.end - 1]);
//console.log('===', loc.substring(part.start, part.end));
		if (prev.end - prev.start == 1 && prev.ignore !== true) {
			part.start--;
			prev.ignore = true;
		} else if (part.end - part.start == 1) {
			// Only one word means it is part of previous one
			prev.end++;
			part.ignore = true;
		} else if (part.start <= prev.start || part.end <= prev.end) {
			prev.ignore = true;
		} else if (loc[part.end - 1] == '弄' && loc[prev.end - 1] == '巷') {
			part.ignore = true;
			prev.end = part.end;
		} else if (loc[prev.start] === '國' && loc[prev.end - 1] === '道') {
			part.start -= 2;
			prev.ignore = true;
		} else if (loc[part.end - 2] == '之' && loc[part.end - 1] == '號') {
			// invalid, there is no number
			part.ignore = true;
		} else if (loc[part.end - 2] == '車' && loc[part.end - 1] == '道') {
			part.ignore = true;
		} else if (loc[prev.end - 2] == '編' && loc[prev.end - 1] == '號') {
			part.ignore = true;
			prev.end = part.end;
		} else if (loc.substring(part.start, part.end) == '電桿') {
			part.ignore = true;
			prev.end = part.end;
		} else if (loc.substring(part.start, part.end) == '電線桿') {
			part.ignore = true;
			prev.end = part.end;
		} else if (loc.substring(part.start, part.end) == '燈桿') {
			part.ignore = true;
			prev.end = part.end;
		}

		return part;
	}, null);

	geoParts = geoParts
		.filter(function(part) {
			return (part.ignore !== true);
		})
		.map(function(part) {
			return {
				v: loc.substring(part.start, part.end)
			};
		})
		.filter(function(part) {

			if (part.v.length === 1 ||
				part.v === '口' ||
				part.v === '口。' ||
				part.v === '前。'||
				part.v === '旁路' ||
				part.v === '道路' ||
				part.v === '對面' ||
				part.v === '產業道路' ||
				part.v === '旁產業道路' ||
				part.v === '車道')
				return false;

			return (part.v !== '');
		});
	
	geoParts.reduce(function(prev, part) {

			if (prev === null)
				return part;

			if (prev.v === part.v)
				part.ignore = true;

			return part;
		}, null);
	
	geoParts = geoParts.filter(function(part) {
			return (part.ignore !== true);
		})
		.map(function(part) {
			return part.v;
		})


	return geoParts;
};

var _parseLoc = function(loc, skipRule) {

	var x = parseLocation(loc, skipRule || 0);
	if (x.length > 1) {
		let newArr = [ x.shift() ];

		for (var index = 0; index < x.length; index++) {
			newArr = newArr.concat(_parseLoc(x[index], 5));
		}

		x = newArr;
	}

	var newArray = [];
	x.forEach(function(v) {
		if (newArray.indexOf(v) === -1)
			newArray.push(v);
	});

	return newArray;
};

var parseLoc = function(rawLoc) {

	let locs = rawLoc
		.replace(/ /g, '')
		.replace(/\./g, '')
		.replace(/前0公尺數/g, '、')
		.replace(/前0公尺/g, '')
		.replace(/旁路口\(附近\)/g, '、')
		.replace(/口\\(附近\\)/g, '')
		.replace(/\(口\)/g, '、')
		.replace(/\(附近\)/g, '')
		.replace(/車道口/g, '車道口、')
		.replace(/附近路口/g, '')
		.replace(/附近/g, '')
		.replace(/口前/g, '')
		.replace(/段上/g, '段')
		.replace(/街路/g, '街')
		.replace(/路路口/g, '路')
		.replace(/路口/g, '路')
		.replace(/路路/g, '路')
		.replace(/段路/g, '段')
		.replace(/巷口/g, '巷')
		.replace(/段口/g, '段')
		.replace(/街口/g, '街')
		.replace('/１', '1')
		.replace(/２/g, '2')
		.replace(/３/g, '3')
		.replace(/４/g, '4')
		.replace(/５/g, '5')
		.replace(/６/g, '6')
		.replace(/７/g, '7')
		.replace(/８/g, '8')
		.replace(/９/g, '9')
		.replace(/０/g, '0')
		.replace(/1段/g, '一段')
		.replace(/2段/g, '二段')
		.replace(/3段/g, '三段')
		.replace(/4段/g, '四段')
		.replace(/5段/g, '五段')
		.replace(/6段/g, '六段')
		.replace(/7段/g, '七段')
		.replace(/8段/g, '八段')
		.replace(/9段/g, '九段')
		.replace(/10段/g, '十段')
		.replace(/一號/g, '一號')
		.replace(/二號/g, '2號')
		.replace(/三號/g, '3號')
		.replace(/四號/g, '4號')
		.replace(/五號/g, '5號')
		.replace(/六號/g, '6號')
		.replace(/七號/g, '7號')
		.replace(/八號/g, '8號')
		.replace(/九號/g, '9號')
		.replace(/十號/g, '10號')
		.replace(/後方/g, '')
		.replace(/旁路/g, '')
		.replace(/\((.+)\)/g, '、$1')
		.replace(/口$/, '')
		.replace(/前$/, '')
		.replace(/&#(.{5});/g, (x) => { return unescape('%u' + parseInt(x.replace(/&|#|;/g, '')).toString(16)) })
		.replace(/(.(?!\d)+)(\1)/g, '$2')
		.split(/與|及|、|近/);

	let results = [];
	locs
		.map(function(loc) {
			return _parseLoc(loc);
		})
		.map(function(geo) {

			var obj = geo.reduce(function(obj, part) {
				if (obj.prev === null) {
					obj.data[obj.counter] = [ part ];
					obj.prev = part;
					return obj;
				}

				var table = [
					'路',
					'段',
					'街',
					'弄',
					'巷',
					'線',
					'道'
				];

				var _prevTmp = obj.prev;
				var _partTmp = part;
				var prevType = table.indexOf(_prevTmp[_prevTmp.length - 1]);
				var partType = table.indexOf(_partTmp[_partTmp.length - 1]);

				// There are two part which is the same type
				if (prevType != -1 && partType != -1) {
					// Create new dataSet for it
					obj.counter++;
					obj.data[obj.counter] = [ part ];
				} else if (partType != -1 && _prevTmp[_prevTmp.length - 1] === '號') {
					// Create new dataSet for it
					obj.counter++;
					obj.data[obj.counter] = [ part ];
				} else {

					// No repeated data
					if (obj.data[obj.counter].indexOf(part) === -1)
						obj.data[obj.counter].push(part);
				}

				obj.prev = part;

				return obj;
			}, {
				prev: null,
				counter: 0,
				data: {}
			});

			Object.values(obj.data).forEach(function(value, index) {
				if (index > 0) {
					var values = value
						.map(function(v) {
							return parseLocation(v);
						})
				}

				results.push(value);
			});
		});

	results = results
		.map(function(element) {
			return element.join('');
		})
		.reduce(function(obj, geo, index) {

			// Remove duplicated element
			if (!obj.tmp.includes(geo)) {

				var regex = geo.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$';
				var ret = obj.tmp.find(function(_geo) {
					if (_geo.search(regex) !== -1) {
						return true;
					}
				});
				if (ret === undefined) {
					obj.tmp.push(geo);
					obj.results.push(results[index]);
				}
			}

			return obj;
		}, { tmp: [], results: [] }).results;

//	console.log('END');

	return results;
};
/*
var x = parseLoc('臺東縣台東市臨海路二段豐谷南路');
console.log(x);
var x = parseLoc('台北市大安區市民大道三段226號');
console.log(x);
var x = parseLoc('台北市大安區市民大道四段48巷1號');
console.log(x);
var x = parseLoc('臺北市中山區中山北路中山北路市民大道');
console.log(x);
var x = parseLoc('臺北市中山區中山北路中山北路 市民大道');
console.log(x);
var x = parseLoc('新北市新莊區新北大道七段鳳山街路');
console.log(x);
var x = parseLoc('臺北市北投區大度路2段大度路2段 第2迴轉道');
console.log(x);
var x = parseLoc('苗栗縣竹南鎮大厝里全天路12376號路燈附近路口(附近)台13甲線3公里0公尺處南向外側車道');
console.log(x);
var x = parseLoc('臺中市西區平和里中華路四維街(口)');
console.log(x);
var x = parseLoc('臺中市神岡區國道一號165公里200公尺處南向內側路肩車道');
console.log(x);
var x = parseLoc('臺中市烏日區湖日里新興路廣惠三巷公園路(口)736巷口(附近)');
console.log(x);
var x = parseLoc('臺南市仁德區上崙里中正路一段田厝高幹163號電桿前(附近)');
console.log(x);
var x = parseLoc('屏東縣麟洛鄉中山路、長安巷口(附近)台一線402公里800公尺處南向外側車道');
console.log(x);
var x = parseLoc('臺南市七股區大埕里176道路佳七高幹98號電燈桿(大寮橋)前(附近)');
console.log(x);
var x = parseLoc('宜蘭縣三星鄉中興路(尚武村047號電桿前)(附近)宜26線7公里0公尺處東向外側車道');
console.log(x);
var x = parseLoc('桃園縣新屋鄉後&#24210;村6路鄰22號旁路口(附近)');
console.log(x);
var x = parseLoc('彰化縣大村鄉美港路(村上所)');
console.log(x);
var x = parseLoc('宜蘭縣冬山鄉三堵路191線道南下側車道口(附近)191甲線18公里900公尺處南向內側車道');
console.log(x);
var x = parseLoc('臺南市永康區鹽行里三村一街仁愛街(口)');
console.log(x);
var x = parseLoc('臺北市中正區仁愛路紹興南街(口)仁愛路 紹興南街');
console.log(x);

var x = parseLoc('嘉義縣民雄鄉&#21452;福村建國路二段42號前(附近)台1線260公里500公尺處北向機車優先車道');
console.log(x);
*/

var Parser = module.exports = function(options) {
	if (!(this instanceof Parser))
		return new Parser(options);

	var options = this.options = options || {
		highWaterMark: 16,
		outputString: false
	};

	Transform.call(this, {
		highWaterMark: options.highWaterMark || 16,
		objectMode: true
	});

	return this;
}

util.inherits(Parser, Transform);
var counter = 0;
Parser.prototype._transform = function(data, encoding, callback) {
//counter++;
//console.log(counter);

	if (data.length <= 1)
		return callback();

	var isInvalid = data
		.map(function(value) {
			return (!value);
		})
		.find(function(value) {
			return value;
		});
	if (isInvalid) {
		console.log('Invalid data');
		return callback();
	}

	if (data[0] === '發生時間')
		return callback();
//console.log(data.join(','));
//return callback();

	try {
		let date = sscanf(data[0], '%s年%s月%s日 %s時%s分').map(function(v) {
			return parseInt(v, 10);
		});

		let m = moment()
			.year(date[0] + 1911)
			.month(date[1] - 1)
			.date(date[2])
			.hour(date[3])
			.minutes(date[4])
			.second(0)
			.millisecond(0);

		// Clean location information
		let results = parseLoc(data[1]);

		// Getting statistics
		var stat = data[2].split(';');
		var death = parseInt(stat[0].replace('死亡', ''));
		var injured = parseInt(stat[1].replace('受傷', ''));

		var ret = this.push({
			time: m.toDate(),
			geo: results,
			death: death,
			injured: injured,
			length: results.length
		});

		return callback();
	} catch(e) {
		return this.emit('error', e);
	}
};
