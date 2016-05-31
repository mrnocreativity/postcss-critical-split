'use strict';
var path = require('path'),
	fs = require('fs'),
	postcss = require('postcss');

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
		filename = '',
		pattern = /CRITICAL/;

	if (typeof options.pattern !== 'undefined') {
		pattern = options.pattern;
	}

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

		originalCss.walkRules(processRule.bind(null, criticalCss, pattern));
		originalCss.walkAtRules(processRule.bind(null, criticalCss, pattern));

		fs.writeFileSync(path.join(relativeDirectory, nonCriticalFilename), originalCss.toResult());

		if(criticalCss.nodes.length > 0) {
			fs.writeFileSync(path.join(relativeDirectory, criticalFilename), criticalCss.toResult());
		}
	};
}

function processRule(criticalCss, pattern, rule) {
	if (rule.toString().match(pattern)) {
		if (rule.parent.name != 'media') {
			rule.remove();
			criticalCss.append(rule);
		} else {
			var mediaq_in_newcss = false;

			criticalCss.eachAtRule('media', function(mediaq) {
				if (mediaq.params == rule.parent.params) {
					rule.remove();
					mediaq.append(rule);
					mediaq_in_newcss = true;
					return false;
				}
			});

			if (!mediaq_in_newcss) {
				var parent = rule.parent.clone();
				parent.eachRule(function(r) { r.remove(); });
				rule.remove();
				parent.append(rule);
				criticalCss.append(parent);
			}
		}
	}
}

module.exports = postcss.plugin('postcss-critical-split', CriticalSplit);
