# postcss-critical-split
A PostCSS plugin that takes existing CSS files and splits out the annotated critical styles into a seperate file, inspired by https://github.com/wladston/postcss-split

![A PostCSS plugin to split your Critical CSS from the rest](https://raw.githubusercontent.com/mrnocreativity/postcss-critical-split/master/critical-split.gif)

## What exactly does this plugin do?
* It supports 3 output modes: `critical`, `rest` and `input`. This can be used to choose which type of output you'd like to generate.
* In critical-output-mode it goes through the given CSS files and finds all rules that have a CSS comment in them that indicates they are critical. These rules are isolated and returned to PostCSS (this is called the critical CSS).
* In rest-output-mode it goes through the given CSS files and finds all rules that have a CSS comment in them that indicates they are critical. These rules ignored; the rest is returned to PostCSS (this is called the rest CSS).
* It can select/ignore critical CSS rules between start- & end-comment-tags or select/ignore rules based on a single line in a CSS block.
* It keeps track of media-queries: If a tagged rule is inside a media query, the media query will be copied to the critical CSS as well.
* It also works inside @font-face declarations: you can tag @font-face declarations which will be added to the critical CSS as well.
* It also supports @keyframes: if a keyframes animation is found in the critical CSS, it gets added to the critical CSS at once.
* You can label your critical CSS with so-called module names. This allows for selecting which pieces of critical CSS you actually want to extract (and keep things as lean as possible). This comes in handy to select only what is absolutely necessary for a specific page template in your website.

## What does it NOT do?
* It does not automatically detect which rules should be considered critical. You have to tag them yourself.
* It does not change any paths in the critical ruleset. If you want are to include the critical-CSS file in the head of your site, you WILL need to run another PostCSS to adapt the paths. Check out this example for more info: https://github.com/mrnocreativity/critical-css-example
* Remove the tag-comment you added yourself. This can be removed in a later stage with other capable and proven PostCSS plugins

## Why should I tag my CSS rules myself?
For larger scale projects, automating critical-CSS detection is complicated, unprecise or damn-nearly impossible. Annotating your CSS with a simple comment gives your perfect control over which CSS rules are to be considered critical and which ones are not.

If you later decide to no longer support this workflow or switch to a different one (with different tools), the critical-comments are standard CSS and will not break your project.

## Why split the files into 2 (or more) seperate files? Why not immediately move it into HTML?
The idea here is that we want to generate our entire CSS file first and then split out what is considered 'critical'.
Injecting it into an HTML file right away would be fairly dictative of your workflow. This allows for more flexible setups.

For example: during development you could `<link>` the critical-CSS file, while rendering it out into the HTML templates once you get ready for production (remember to adjust the URL's in the CSS file for the changed context of the CSS execution).

## Install

```bash
npm install --save-dev postcss-critical-split
```

## Test
To run tests:
```bash
npm test
```

If you want to contribute to the project and write additional tests, look into the testsuite folder. You'll find a folder per test with input/output results, splitSettings and optional process tasks where you can write a custom test scenario.

## Usage

```javascript
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')));
```
```css
/* before: main.css */

/* critical:start */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}

.aside {
	text-decoration: underline;
}

/* critical:end */

p {
	font-size: 14px;
}

li {
	float: left;
	/* critical:start */
	color: red;
	/* critical:end */
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}

a[rel=external]:before{
	content: '[!]';
	/* critical */
}

/* critical:start */
@media screen and (min-width: 400px) {
	footer {
		padding: 50px;
	}
}
/* critical:end */

@media screen and (min-width: 1400px) {
	header {
		height: 300px;
		/* critical:start */
		background-color: #FF0066;
		font-size: 3em;
		/* critical:end */
	}
}
```

```css
/* after: main.css */

p {
	font-size: 14px;
}

li {
	float: left;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}

@media screen and (min-width: 1400px) {
	header {
		background-color: #FF0066;
		font-size: 3em;
	}
}
```

```css
/* after main-critical.css */

header{
	background-color: #1d1d1d;
	font-size: 2em;
}

.aside {
	text-decoration: underline;
}

li {
	color: red;
}

a[rel=external]:before{
	content: '[!]';
}

@media screen and (min-width: 400px) {
	footer {
		padding: 50px;
	}
}

@media screen and (min-width: 1400px) {
	header {
		background-color: #FF0066;
		font-size: 3em;
	}
}

```

## Options
The plugin accepts an object with additional options.

### options.output
*defaults to `critical`*
Allowed values: `critical`, `rest` or `input` to return either the critical-css, the rest-css or just the original input-css.

### options.blockTag
*defaults to `critical`*

This is the comment text that is matched in every rule/atRule in the original CSS file. If the blockTag is encountered in a rule, the rule is appended to the critical-CSS file and removed in the original file. All declarations in the rule will be carried over.
```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'blockTag':'criticalCss'
	}));
```
```css
/* before: main.css */
header{
	/* criticalCss */
	background-color: #1d1d1d;
	font-size: 2em;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```
```css
/* after: main.css */
footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```
```css
/* after: main-critical.css */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}
```

### options.startTag & options.stopTag
*startTag defaults to `critical:start`*
*stopTag defaults to `critical:end`*

These are the comment texts that are matched throughout the original CSS file. If the startTag is encountered, every rule, declaration, atRule is carried into the critical-CSS until the stopTag is encountered. All the rules that appy will be removed from the original CSS.

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'startTag':'grab:open',
		'stopTag':'grab:close',
	}));
```
```css
/* before: main.css */

/* grab:open */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}

.aside {
	text-decoration: underline;
}

/* grab:close */

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```
```css
/* after: main.css */
footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```

```css
/* after: main-critical.css */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}
.aside {
	text-decoration: underline;
}
```

### options.modules
* defaults to `null`, should be an array of strings*

These are the modules you want to select from your css file into the critical file. This allows for targetting which parts of the CSS to include in the critical and which ones not.
CSS rules that are not labeled by a module will be considered 'common' and thus will be added to the critical CSS at all times.

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'modules': ['header', 'top-photo']
	}));
```
```css
/* before: main.css */

/* critical:start:header */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}
/* critical:end */

.login-button {
	display: block;
	border: red thin solid;
}

/* critical:start:top-photo */
.top-photo{
	background-color: #1d1d1d;
	font-size: 2em;
}
/* critical:end */

/* critical:start:preview-article */
.preview-article{
	color: #CCC;
}
/* critical:end */

/* critical:start */
.profile-picture{
	float: right;
	width: 20%;
	height: auto;
}
/* critical:end */

.aside {
	text-decoration: underline;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```
```css
/* after: main.css */
.login-button {
	display: block;
	border: red thin solid;
}

.preview-article{
	color: #CCC;
}

.aside {
	text-decoration: underline;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```

```css
/* after: main-critical.css */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}

.top-photo{
	background-color: #1d1d1d;
	font-size: 2em;
}

.aside {
	text-decoration: underline;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```

### options.separator
* defaults to `:`*

This is the seperator used in your critical start-tag to tag a module.

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'modules': ['header', 'top-photo'],
		'seperator': '--'
	}));
```

```css
/* critical:start--header */

```
