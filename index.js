'use strict';
var path = require('path'),
	fs = require('fs'),
	postcss = require('postcss'),
	critical = {
		'start': 'critical:start',
		'end': 'critical:end'
	},
	criticalActive = false;

function createCriticalFilename(filename, suffix) {
	var position = filename.lastIndexOf('.css'),
		result = '';

	result = filename.substring(0, position);
	result += suffix;
	result += '.css';

	return result;
}

function CriticalSplit(options) {
	var options = options || {},
		filenameSuffix = '-critical',
		filename = '';

	if (typeof options.suffix !== 'undefined') {
		filenameSuffix = options.suffix;
	}

	return function(originalCss, result) {
		var criticalCss = postcss.root(),
			absolutePath = originalCss.source.input.file,
			cwd = process.cwd(),
			relativePath = path.relative(cwd, absolutePath),
			nonCriticalFilename = path.basename(relativePath),
			relativeDirectory = path.dirname(relativePath),
			criticalFilename = createCriticalFilename(nonCriticalFilename, filenameSuffix);

		originalCss.walk(processRule.bind(null, criticalCss)); // all rules

		fs.writeFileSync(path.join(relativeDirectory, nonCriticalFilename), originalCss.toResult());

		if(criticalCss.nodes.length > 0) {
			fs.writeFileSync(path.join(relativeDirectory, criticalFilename), criticalCss.toResult());
		}
	};
}

function processRule(parentRule, rule) {
	var newRule = null;

	if (rule.type === 'comment' && rule.text === critical.start) {
		criticalActive = true;
		rule.remove();
	} else if (rule.type === 'comment' && rule.text === critical.end) {
		criticalActive = false;
		rule.remove();
	} else if(criticalActive === true) {
		switch (rule.type) {
			case 'atrule':
			case 'rule':
				newRule = rule.clone();
				parentRule.append(newRule);

				newRule.walk(function(nestedRule) {
					nestedRule.remove();
				});

				//to understand recursion you first need to understand recursion
				rule.walk(processRule.bind(null, newRule));

				break;
			case 'comment':
			case 'decl':
				parentRule.raws.semicolon = true;
				parentRule.append(rule);
				break;
			default:
				console.log('missed one!!', rule.type);
				break;
		}

		rule.remove();
	}
}

module.exports = postcss.plugin('postcss-critical-split', CriticalSplit);
