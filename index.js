'use strict';
var path = require('path'),
	fs = require('fs'),
	postcss = require('postcss'),
	critical = {
		'start': 'critical:start',
		'end': 'critical:end'
	},
	criticalActive = false,
	latestRule = null,
	latestRuleAdded = false,
	temp = null;

function createCriticalFilename(filename, suffix) {
	var position = filename.lastIndexOf('.css'),
		result = '';

	result = filename.substring(0, position);
	result += suffix;
	result += '.css';

	return result;
}

function clearRule(rule) {
	rule.walk(function(nestedRule) {
		nestedRule.remove();
	});
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
	var newRule = null,
		allowInherit = true;

	if (rule.type === 'comment' && rule.text === critical.start) {
		criticalActive = true;
		latestRuleAdded = false;

		if (rule.parent.type === 'rule') {
			latestRule = rule.parent.clone();
			clearRule(latestRule);
			//console.log('newline', latestRule.parent);
		}

		rule.remove();
	} else if (rule.type === 'comment' && rule.text === critical.end) {
		criticalActive = false;
		latestRule = null;
		rule.remove();
	} else if(criticalActive === true) {
		switch (rule.type) {
			case 'atrule':
			case 'rule':
				if (latestRuleAdded === true && latestRule !== null) {
					parentRule = latestRule;
					console.log('captured the latestRule');
				}

				newRule = rule.clone();
				parentRule.append(newRule);

				clearRule(newRule);

				//to understand recursion you first need to understand recursion
				rule.walk(processRule.bind(null, newRule));

				break;
			case 'comment':
			case 'decl':
				if (latestRule !== null) {
					// console.log('rule.parent:', rule.parent.selector);
					// console.log('inherited parent:', parentRule.selector);
					// console.log('latest:', latestRule.selector);

					if (typeof parentRule.selector !== 'undefined' && parentRule.selector === rule.parent.selector){
						console.log('!! !! !! mismatch detected');
						allowInherit = false;
					} else {
						allowInherit = true;
					}

					console.log('------------------');
					//latestRule = null;
				}

				if (allowInherit === true && latestRule !== null) {
					if (latestRuleAdded === false) {
						//console.log('need parent rule');
						parentRule.append(latestRule);
						parentRule = latestRule;
						latestRuleAdded = true;
					} else {
						parentRule = latestRule;
					}
				}

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
