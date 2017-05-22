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
		'output': output_types.CRITICAL_CSS,
		'save': false,
		'modules': null,
		'separator': ':',
		'debug': false
	},
	stats = null;

function CriticalSplit(newOptions) {
	newOptions = newOptions || {};

	return function(originalCss, result) {
		if (applyUserOptions(newOptions)) {
			setupStats();
			performTransform(originalCss, result);

			if (userOptions.debug === true) {
				processStats();
			}
		}

		return result;
	};
}

function timestamp() {
	return new Date().getTime();
}

function setupStats() {
	stats = {};
	stats.startTime = 0;
	stats.endTime = 0;
	stats.processTime = 0;

	stats.rules = 0;
	stats.criticals = 0;
	stats.criticalPercentage = 0;

	stats.loops = 0;

	stats.clones = 0;
	stats.emtpyClones = 0;

	stats.compares = 0;
	stats.appends = 0;
	stats.getParents = 0;
	stats.parentRequest = 0;
}

function processStats() {
	var key = null,
		value = null,
		message = '';

	stats.processTime = stats.endTime - stats.startTime;
	message += '----- postcss-critical-split debug info ---------\n';

	for (key in stats) {
		/* istanbul ignore else */
		if (stats.hasOwnProperty(key)) {
			value = stats[key];

			switch(key) {
				case 'processTime':
					value = value + 'ms';
					break;
				case 'startTime':
				case 'endTime':
					value = null;
					break;
				case 'criticalPercentage':
					value = (stats.criticals / stats.rules * 100).toFixed(2) + '%';
					break;
			}

			if (value !== null) {
				message += key + ': ' + value + '\n';
			}
		}
	}

	message += '-------------------------------------------------\n';
	console.log(message);
}

function performTransform(inputCss, result) {
	var originalCss = clone(inputCss),
		criticalCss = postcss.root(),
		absolutePath = null,
		directoryPath = null,
		nonCriticalFilename = null,
		criticalFilename = null;

	getAllCriticals(originalCss, criticalCss);

	cleanUp(originalCss);
	cleanUp(criticalCss);

	if (userOptions.save === true) {
		console.warn('postcss-critical-split: The save feature has been deprecated and should be avoided. This feature will be removed in v3.0.0. Read more about it here: https://github.com/mrnocreativity/postcss-critical-split/issues/3');

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

function hasEndMarker(block) {
	var result = false;

	block.walkComments(function(line) {
		if (line.text === userOptions.endTag) {
			result = true;
		}
	});

	return result;
}

function applyUserOptions(newOptions) {
	var errorMessage ='',
		result = true;

	userOptions = merge(true, defaults);
	merge(userOptions, newOptions);

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

	if (typeof userOptions.modules === 'string'){
		userOptions.modules = [userOptions.modules];
	} else if (userOptions.modules instanceof Array === false) {
		userOptions.modules = defaults.modules;
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

function getAllCriticals(originalCss, criticalCss) {
	var currentLevel = null,
		blockMarkers = getModuleMarkers(userOptions.blockTag),
		moduleMarkers = getModuleMarkers(userOptions.startTag);

	stats.startTime = timestamp();
	originalCss.walk(function(line) {
		var temp = null;

		stats.rules++;
		line.parent.raws.semicolon = true;
		stats.parentRequest++;

		if (line.type === 'comment' && line.text === userOptions.endTag) {
			criticalActive = false
			currentLevel = null;
			line.remove(); // remove tagging comment
		} else if (line.type === 'comment' && isBlockTag(line.text, blockMarkers)) {
			if (hasParentAtRule(line, 'keyframes')) {
				stats.criticals++;
				temp = appendFullBlock(criticalCss, line, 'keyframes');
				removeMarkersInBlock(temp, blockMarkers, moduleMarkers);
			} else {
				appendFullBlock(criticalCss, line);
				line.remove(); // remove tagging comment
			}
		} else if (line.type === 'comment' && isStartTag(line.text, moduleMarkers)) {
			criticalActive = true;
			line.remove(); // remove tagging comment
		} else if (criticalActive === true && (line.type === 'atrule' && line.name === 'keyframes')) { //keyframes shouldn't be split
			stats.criticals++;
			temp = appendDeclaration(criticalCss, line);
			removeMarkersInBlock(temp, blockMarkers, moduleMarkers);

			if (hasEndMarker(line) === true) {
				criticalActive = false;
			}
		} else if (criticalActive === true && (line.type === 'decl' && hasParentAtRule(line, 'keyframes') === true)) {
			// ignore this rule...
		} else if (criticalActive === true && (line.type === 'atrule' && line.name === 'font-face')){
			// this is a rather difficult one
			// @font-face is a 'naked atrule': it has no params at all
			// it is defined once every time you want to add a font
			// so we can't rely on 'searching for existing parent atrules' for new declarations as it might cross the context
			// so we manually add the atrule ourselves whenever we come across once
			stats.criticals++;
			appendEmptyRule(criticalCss, line);
		} else if (criticalActive === true && (line.type === 'decl' || line.type === 'comment')) {
			stats.criticals++;
			appendDeclaration(criticalCss, line);
			line.remove(); // remove line from originalCss as it is now alive in criticalCss
		}
	});
	stats.endTime = timestamp();

	originalCss.raws.semicolon = true;
}

function getModuleMarkers(startTag) {
	var modules = userOptions.modules,
		markers = null;

	if (userOptions.modules !== null) {
		markers = [];

		modules.forEach(function(currentModule){
			stats.loops++;
			markers.push(startTag + userOptions.separator + currentModule);
		});
	}

	return markers;
}

function isMarkedTag(currentText, marker, markers) {
	var result = false;

	if (currentText === marker) {
		result = true;
	} else if (markers !== null && markers.indexOf(currentText) != -1) {
		result = true;
	}

	return result;
}

function isBlockTag(currentText, moduleMarkers) {
	return isMarkedTag(currentText, userOptions.blockTag, moduleMarkers);
}

function isStartTag(currentText, moduleMarkers) {
	return isMarkedTag(currentText, userOptions.startTag, moduleMarkers);
}

function getBlockFromTriggerTag(line, parentAtRule) {
	var result = null;

	if (typeof parentAtRule === 'undefined') {
		stats.parentRequest++;

		if (line.parent.type !== 'root') {
			result = line.parent;
			stats.parentRequest++;
		}
	} else {
		result = getParentAtRule(line, parentAtRule, true);
	}

	return result;
}

function appendFullBlock(criticalCss, line, parentAtRule) {
	var currentLevel = null,
		parents = null,
		block = getBlockFromTriggerTag(line, parentAtRule),
		temp = null;

	if (block !== null) {
		parents = getParents(line);

		if (block.type === 'atrule' && block.name === 'font-face') {
			appendEmptyRule(criticalCss, block);
		}

		currentLevel = prepareSelectors(criticalCss, parents);

		if (currentLevel.type === 'rule' || currentLevel.type === 'atrule') {
			if (block.name === 'keyframes') {
				if (areTheSame(block, currentLevel)) {
					temp = currentLevel;
					currentLevel = currentLevel.parent;
					temp.remove();
				}
				currentLevel.append(clone(block));
			} else {
				block.walk(function(currentLine) {
					var level = null;

					// we don't want to add the blockTag comment back; skip that
					// we don't want to loop over content that is inside a keyframes rule, it has been added already

					if (!(currentLine.type === 'comment' && line.text === currentLine.text)){
						currentLevel.append(currentLine.clone());
						stats.appends++;
						currentLine.remove();
						currentLevel.raws.semicolon = true;
					}
				});
			}
		}
	}

	return currentLevel;
}

function appendDeclaration(criticalCss, line) {
	var parents = getParents(line),
		currentLevel = prepareSelectors(criticalCss, parents),
		rule = clone(line);

	currentLevel.append(rule);
	stats.appends++;
	currentLevel.raws.semicolon = true;

	return rule;
}

function removeCommentIfMarker(blockMarkers, moduleMarkers, line) {
	if (line !== null) {
		if(line.type === 'comment' && (line.text === userOptions.endTag || isBlockTag(line.text, blockMarkers)) || isStartTag(line.text, moduleMarkers)) {
			line.remove();
		}
	}
}

function removeMarkersInBlock(line, blockMarkers, moduleMarkers) {
	if (line !== null && typeof line.walkComments === 'function') {
		line.walkComments(removeCommentIfMarker.bind(null, blockMarkers, moduleMarkers));
	} else {
		removeCommentIfMarker(blockMarkers, moduleMarkers, line);
	}
}

function appendEmptyRule(criticalCss, line) {
	var rule = clone(line, true);

	appendDeclaration(criticalCss, rule);

	return rule;
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
		stats.loops++;
		temp = selectorLevels[i];

		if (typeof currentLevel.last !== 'undefined' && areTheSame(temp, currentLevel.last)) {
			currentLevel = currentLevel.last;
		} else {
			if (currentLevel.name !== 'keyframes') {
				currentLevel.append(temp);
				currentLevel = temp;
				currentLevel.raws.semicolon = true;
			}

			temp = null;
		}
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
		stats.loops++;
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
		stats.compares++;
		tempA = clone(a, true);
		tempB = clone(b, true);

		if (tempA.toString() === tempB.toString()) {
			result =  true;
		}
	}

	return result;
}

function getParentAtRule(line, name) {
	var result = null,
		currentParent = line.parent;

	while (result === null && typeof currentParent !== 'undefined' && currentParent !== null) {
		if (currentParent.type === 'atrule' && currentParent.name === name) {
			result = currentParent;
		} else {
			stats.parentRequest++;
			currentParent = currentParent.parent;
		}
	}

	return result;
}

function hasParentAtRule(line, name) {
	var result = true,
		parent = getParentAtRule(line, name);

	if (parent === null) {
		result = false;
	}

	return result;
}

function getParents(line) {
	var parents = [],
		currentParent = null,
		temp = null;

	stats.getParents++;
	currentParent = line.parent;
	stats.parentRequest++;

	while (typeof currentParent !== 'undefined' && currentParent.type !== 'root') {
		temp = clone(currentParent, true);
		parents.push(temp);
		temp = null;
		currentParent = currentParent.parent;
		stats.parentRequest++;
	}

	parents = parents.reverse();

	return parents;
}

function clone(originalRule, makeEmpty) {
	var newRule = null,
		temp = null;

	if (makeEmpty === true) {
		temp = originalRule.nodes;
		originalRule.nodes = [];
		newRule = originalRule.clone();
		originalRule.nodes = temp;
		stats.emtpyClones++;
	} else {
		newRule = originalRule.clone();
		stats.clones++;
	}

	return newRule;
}

module.exports = postcss.plugin('postcss-critical-split', CriticalSplit);
module.exports.output_types = output_types;

