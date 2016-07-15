'use strict';

var output_types = {
		'INPUT_CSS': 'input',
		'CRITICAL_CSS': 'critical',
		'REST_CSS': 'rest'
	},
	path = require('path'),
	fs = require('fs'),
	merge = require('merge'),
	postcss = require('postcss'),
	userOptions = null,
	criticalActive = false,
	defaults = {
		'startTag': 'critical:start',
		'endTag': 'critical:end',
		'blockTag': 'critical',
		'suffix': '-critical',
		'output': output_types.INPUT_CSS,
		'save': false
	};

function CriticalSplit(newOptions) {
	newOptions = newOptions || {};

	return function(originalCss, result) {
		if (applyUserOptions(newOptions)) {
			performTransform(originalCss, result);
		};
	};
}

function performTransform(inputCss, result) {
	var originalCss = inputCss.clone(true),
		criticalCss = postcss.root(),
		absolutePath = null,
		directoryPath = null,
		nonCriticalFilename = null,
		criticalFilename = null;

	getAllCriticals(originalCss, criticalCss);

	cleanUp(originalCss);
	cleanUp(criticalCss);

	if (userOptions.save === true) {
		absolutePath = originalCss.source.input.file,
		directoryPath = path.dirname(absolutePath),
		nonCriticalFilename = path.basename(absolutePath),
		criticalFilename = createCriticalFilename(nonCriticalFilename);

		saveCssFile(path.join(directoryPath, nonCriticalFilename), originalCss);
		saveCssFile(path.join(directoryPath, criticalFilename), criticalCss);
	}

	switch(userOptions.output) {
		case output_types.INPUT_CSS:
			result.root = inputCss;
			break;
		case output_types.CRITICAL_CSS:
			result.root = criticalCss;
			break;
		case output_types.REST_CSS:
			result.root = originalCss;
			break;
	}
}

function saveCssFile(filepath, cssRoot) {
	if (cssRoot.nodes.length > 0) {
		fs.writeFileSync(filepath, cssRoot.toResult());
	}
}

function cleanUp(cssRoot) {

	var handleBlock = function(block) {
		if (block.nodes && block.nodes.length === 0) {
			block.remove();
		}
	};

	cssRoot.walkRules(handleBlock);
	cssRoot.walkAtRules(handleBlock);

	cssRoot.raws.semicolon = true;
}

function applyUserOptions(newOptions) {
	var errorMessage ='',
		result = true;

	userOptions = merge(defaults, newOptions);

	if (userOptions.startTag === userOptions.endTag) {
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
	level.raws.semicolon = true;
}

function getAllCriticals(originalCss, criticalCss) {
	var currentLevel = null;

	originalCss.walk(function(line) {
		var temp = null;

		line.parent.raws.semicolon = true;

		if (line.type === 'comment' && line.text === userOptions.blockTag) {
			appendFullBlock(criticalCss,line);
			line.remove(); // remove tagging comment
		} else if (line.type === 'comment' && line.text === userOptions.startTag) {
			criticalActive = true;
			line.remove(); // remove tagging comment
		} else if (line.type === 'comment' && line.text === userOptions.endTag) {
			criticalActive = false
			currentLevel = null;
			line.remove(); // remove tagging comment
		} else if (criticalActive === true && (line.type === 'atrule' && line.name === 'font-face')){
			console.log('font-face rule found');
			// console.log(line);
			appendEmptyRule(criticalCss, line);
		} else if (criticalActive === true && (line.type === 'decl' || line.type === 'comment')) {
			appendDeclaration(criticalCss, line);
			line.remove(); // remove line from originalCss as it is now alive in criticalCss
		}
	});

	originalCss.raws.semicolon = true;
}

function getBlockFromTriggerTag(line) {
	var result = null;

	if (line.parent.type !== 'root') {
		result = line.parent;
	}

	return result;
}

function appendFullBlock(criticalCss, line) {
	var currentLevel = null,
		parents = null,
		block =  getBlockFromTriggerTag(line);

	if (block !== null) {
		parents = getParents(line);
		currentLevel = prepareSelectors(criticalCss, parents);

		if (currentLevel.type === 'rule') {
			block.walk(function(line) {
				if (!(line.type === 'comment' && line.text === userOptions.blockTag)){
					// we don't want to add the blockTag comment back; skip that
					currentLevel.append(line);
					line.remove();
					currentLevel.raws.semicolon = true;
				}
			});
		}
	}
}

function appendDeclaration(criticalCss, line) {
	var parents = getParents(line),
		currentLevel = prepareSelectors(criticalCss, parents);

	currentLevel.append(line);
	currentLevel.raws.semicolon = true;
}

function appendEmptyRule(criticalCss, line) {
	var rule = line.clone();

	rule.removeAll();
	appendDeclaration(criticalCss, rule);
}

function prepareSelectors(criticalCss, selectorLevels) {
	var currentLevel = null;

	currentLevel = findSelector(criticalCss, selectorLevels);

	if (currentLevel === null) {
		currentLevel = createSelectorLevels(criticalCss, selectorLevels);
		currentLevel.raws.semicolon = true;
	}

	return currentLevel;
}

function createSelectorLevels(criticalCss, selectorLevels) {
	var i = null,
		currentLevel = null,
		temp = null;

	currentLevel = criticalCss;

	for (i = 0; i < selectorLevels.length; i++) {
		temp = selectorLevels[i];
		currentLevel.append(temp);
		currentLevel = temp;
		currentLevel.raws.semicolon = true;
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
module.exports.output_types = output_types;

