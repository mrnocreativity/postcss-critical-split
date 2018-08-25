'use strict';

var postcss = require('postcss'),
	criticalSplit = require('./index'),
	tests = null,
	directories = null,
	fs = require('fs'),
	path = require('path'),
	tests = null,
	singleRequest = process.argv[process.argv.length - 1];

if (singleRequest === 'test.js') singleRequest = null;

function getDirectories(srcPath) {
	return fs.readdirSync(srcPath).filter(function(file) {
		return fs.statSync(path.join(srcPath, file)).isDirectory();
	});
}

function loadAllTests() {
	var testDirectory = './testsuite',
		directories = getDirectories(testDirectory),
		i = 0,
		currentPath = '',
		currentTest = null;

	tests = [];

	for (i; i < directories.length; i++) {
		currentPath = path.join(testDirectory, directories[i]);

		currentTest = {};
		currentTest.setup = require('./' + path.join(currentPath, 'setup'));

		try {
			currentTest.split = require('./' + path.join(currentPath, 'split-settings'));
		} catch(ex) {
			//do nothing
		}
		currentTest.directory = currentPath;

		tests.push(currentTest);
	}
}

function getSingleTest(testName) {
	if (!testName) return null;

	var testDirectory = './testsuite',
		currentPath = path.join(testDirectory, testName),
		testIsValid = true,
		theTest = {
			'directory': currentPath
		};

	try {
		theTest.setup = require('./' + path.join(currentPath, 'setup'));
	} catch(e) {
		//this file is required
		testIsValid = false;
	}

	try {
		theTest.split = require('./' + path.join(currentPath, 'split-settings'));
	} catch(ex) {
		// this file is optional
	}

	if (!testIsValid) return null;

	return theTest;
}

function runTests() {
	var i = 0,
		currentTest = 0;

	for (i; i < tests.length; i++) {
		currentTest = tests[i];
		createScenario(currentTest);
	}
}

function run(input, output, opts) {
	return postcss([criticalSplit(opts)]).process(input, {
			'from': 'input.css',
			'to': 'output.css'
		})
		.then(function(result) {
			var resultCss = clean(result.root),
				outputCss = clean(output.root);

			expect(resultCss).toEqual(outputCss);
			expect(result.warnings().length).toBe(0);
		});
}

function createRaws(type) {
	var result = null;

	if (type === 'decl') {
		result = {
			'before': '\n     ',
			'after': ' ',
			'between': ': ',
			'semicolon': true,
			'afterName': ' ',
			'left': ' ',
			'right': ' ',
			'important': '!important'
		};
	} else {
		result = {
			'before': '\n ',
			'after': '\n ',
			'between': ' ',
			'semicolon': true,
			'afterName': ' ',
			'left': ' ',
			'right': ' ',
			'important': '!important'
		};
	}

	return result;
}

function clean(root) {
	root.raws = createRaws();

	root.walk(function(line) {
		line.raws = createRaws(line.type);
	});

	return root.toString();
}

function createScenario(test) {
	var inputBytes = null,
		input = null,
		inputFile = './' + path.join(test.directory, test.setup.input),
		outputBytes = null,
		output = null,
		outputFile = './' + path.join(test.directory, test.setup.output),
		testResult = null,
		customProcess = null;

	inputBytes = fs.readFileSync(inputFile),
	input = postcss.parse(inputBytes, {'from': inputFile}).toResult(),
	outputBytes = fs.readFileSync(outputFile),
	output = postcss.parse(outputBytes, {'from': outputFile}).toResult();

	if (typeof test.setup.process === 'string') {
		customProcess = require('./' + path.join(test.directory, test.setup.process));

		it (test.setup.name, customProcess.bind(null, criticalSplit, input, output, test.split));
	} else {
		it (test.setup.name, function(){
			return run(input, output, test.split);
		});
	}
}

var singleTest = getSingleTest(singleRequest);

if (singleTest){
	tests = [];
	tests.push(singleTest);
} else {
	loadAllTests();
}

runTests();
