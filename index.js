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

		originalCss.walkRules(processRule.bind(null, criticalCss, pattern)); // all regular css rules
		originalCss.walkAtRules(processRule.bind(null, criticalCss, pattern)); // all @-rules like '@media' and '@font-face'

		fs.writeFileSync(path.join(relativeDirectory, nonCriticalFilename), originalCss.toResult());

		if(criticalCss.nodes.length > 0) {
			fs.writeFileSync(path.join(relativeDirectory, criticalFilename), criticalCss.toResult());
		}
	};
}

function processRule(criticalCss, pattern, rule) {
	var parent = null;

	if (rule.toString().match(pattern)) {
		if (rule.parent.name != 'media') {
			rule.remove();
			criticalCss.append(rule);
		} else {
			// the previous version of this plugin grouped media queries but the problem with that was that the order would change. That's not desirable.
			parent = rule.parent.clone();
			parent.walkRules(function(r) { r.remove(); });
			rule.remove();
			parent.append(rule);
			criticalCss.append(parent);
		}
	}
}

module.exports = postcss.plugin('postcss-critical-split', CriticalSplit);
