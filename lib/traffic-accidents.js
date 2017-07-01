var request = require('request');
var csv = require('csv');
var pipe = require('multipipe');
var Parser = require('./parser');
var Transform = require('stream').Transform;

module.exports = {
	fetch: function(apiUrl) {
		return request({
			url: apiUrl,
			headers: {
				'user-agent': 'Mozilla/5.0'
			}
		});
	},
	parse: function(opts) {
		return pipe(csv.parse({
			trim: true,
			skip_empty_lines: true,
			relax_column_count: true
		}), new Parser(opts));

	}
};
