'use strict';
var path = require('path'),
	fs = require('fs'),
	merge = require('merge'),
	postcss = require('postcss'),
	userOptions = null,
	criticalActive = false,
	numberOfLinesInOriginalCss = 0,
	numberOfSameChecks = 0,
	numberOfSelectorSearches = 0,
	defaults = {
		'start': 'critical:start',
		'end': 'critical:end',
		'suffix': '-critical'
	};

function CriticalSplit(newOptions) {
	newOptions = newOptions || {};

	return function(originalCss, result) {
		if (applyUserOptions(newOptions)) {
			performTransform(originalCss, result);
		};
	};
}

function performTransform(originalCss, result) {
	var criticalCss = postcss.root(),
		absolutePath = originalCss.source.input.file,
		cwd = process.cwd(),
		relativePath = path.relative(cwd, absolutePath),
		nonCriticalFilename = path.basename(relativePath),
		relativeDirectory = path.dirname(relativePath),
		criticalFilename = createCriticalFilename(nonCriticalFilename);

	getAllCriticals(originalCss, criticalCss);

	// console.log('numberOfLinesInOriginalCss:', numberOfLinesInOriginalCss);
	// console.log('numberOfSameChecks:', numberOfSameChecks);
	// console.log('numberOfSelectorSearches:', numberOfSelectorSearches);

	fs.writeFileSync(path.join(relativeDirectory, nonCriticalFilename), originalCss.toResult());

	if (criticalCss.nodes.length > 0) {
		fs.writeFileSync(path.join(relativeDirectory, criticalFilename), criticalCss.toResult());
	}
}

function applyUserOptions(newOptions) {
	var errorMessage ='',
		result = true;

	userOptions = merge(defaults, newOptions);

	if (userOptions.start === userOptions.end) {
		errorMessage += '\n\n';
		errorMessage += 'ERROR :: PostCSS Plugin: Critical Split\n';
		errorMessage += '.Critical CSS start and end tag must not be the same. \n';
		errorMessage += 'Please adapt your options. \n\n';
		errorMessage += '------ Current Options ----- \n\n';
		errorMessage += JSON.stringify(userOptions, null, 2) + '\n\n';
		errorMessage += '---------- End -------------\n';

		console.error(errorMessage);
		result = false;
	}

	return result;
}

function createCriticalFilename(filename) {
	var position = filename.lastIndexOf('.css'),
		result = '';

	result = filename.substring(0, position);
	result += userOptions.suffix;
	result += '.css';

	return result;
}

function clearLevel(level) {
	level.walk(function(nestedRule) {
		nestedRule.remove();
	});
}

function getAllCriticals(originalCss, criticalCss) {
	var currentLevel = null;

	originalCss.walk(function(line) {
		var temp = null;

		numberOfLinesInOriginalCss++;

		if (line.type === 'comment' && line.text === userOptions.start) {
			criticalActive = true;
			// line.remove(); // remove unnecessary comment
		} else if (line.type === 'comment' && line.text === userOptions.end) {
			criticalActive = false
			currentLevel = null;
			// line.remove(); // remove unnecessary comment
		} else if (criticalActive === true && (line.type === 'decl' || line.type === 'comment')) {
			appendDeclaration(criticalCss, line);
			line.remove();
		}
	});
}

function appendDeclaration(criticalCss, line) {
	var parents = getParents(line),
		currentLevel = prepareSelectors(criticalCss, parents);

	currentLevel.append(line);
	currentLevel.raws.semicolon = true; // enforce last rule semicolon; just in case of some weird last-line comments...
}

function prepareSelectors(criticalCss, selectorLevels) {
	var currentLevel = null;

	currentLevel = findSelector(criticalCss, selectorLevels);

	if (currentLevel === null) {
		currentLevel = createSelectorLevels(criticalCss, selectorLevels);
	}

	return currentLevel;
}

function createSelectorLevels(criticalCss, selectorLevels) {
	var i = null,
		currentLevel = null,
		temp = null;

	numberOfSelectorSearches++;

	currentLevel = criticalCss;

	for (i = 0; i < selectorLevels.length; i++) {
		temp = selectorLevels[i];
		currentLevel.append(temp);
		currentLevel = temp;
		temp = null;
	}

	return currentLevel;
}

function findSelector(criticalCss, selectorLevels) {
	var result = null,
		currentLevel = null,
		temp = null,
		i = null;

	currentLevel = criticalCss;

	for (i = 0; i < selectorLevels.length; i++) {
		temp = selectorLevels[i];
		currentLevel = currentLevel.last;

		if (typeof currentLevel === 'undefined' || areTheSame(temp, currentLevel) === false) {
			currentLevel = null;
			break;
		}
	}

	result = currentLevel;

	return result;
}

function areTheSame(a, b) {
	var tempA = null,
		tempB = null,
		result = false;

	numberOfSameChecks++;

	if (a.type === b.type) {
		tempA = a.clone().removeAll()
		tempB = b.clone().removeAll();

		if (tempA.toString() === tempB.toString()) {
			result =  true;
		}
	}

	return result;
}

function getParents(line) {
	 var parents = [],
		currentParent = null,
		temp = null;

	currentParent = line.parent;

	while (typeof currentParent !== 'undefined' && currentParent.type !== 'root') {
		temp = currentParent.clone();
		clearLevel(temp);
		parents.push(temp);
		temp = null;
		currentParent = currentParent.parent;
	}

	parents = parents.reverse();

	return parents;
}

module.exports = postcss.plugin('postcss-critical-split', CriticalSplit);
