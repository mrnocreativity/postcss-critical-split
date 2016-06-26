# postcss-critical-split
A PostCSS plugin that takes existing CSS files and splits out the annotated critical styles into a seperate file, inspired by https://github.com/wladston/postcss-split

![A PostCSS plugin to split your Critical CSS from the rest](https://raw.githubusercontent.com/mrnocreativity/postcss-critical-split/master/critical-split.gif)

## What exactly does this plugin do?
* It goes through the given CSS files and finds all rules that have a CSS comment in them that indicates they are critical. These rules are then moved out of the original file and saved into a separate critical-CSS file.
* It goes through the given CSS files and finds critcal-start and -end tags. These CSS rules between these 2 markers are then moved out of the original file and saved into a separate critical-CSS file.
* It keeps track of media-queries: If a tagged rule is inside a media query, the media query will be copied to the critical file as well.
* It also works inside @font-face declarations: you can tag @font-face declarations which will be added to the critical-CSS file as well.

## What does it NOT do?
* It does not automatically detect which rules should be considered critical. You have to tag them yourself.
* It does not change any paths in the critical ruleset. If you want are to include the critical-CSS file in the head of your site, you WILL need to run another PostCSS to adapt the paths. Check out this example for more info: https://github.com/mrnocreativity/critical-css-example
* Remove the tag-comment you added yourself. This can be removed in a later stage with other capable and proven PostCSS plugins

## Why should I tag my CSS rules myself?
For larger scale projects, automating critical-CSS detection is complicated, unprecise or damn-nearly impossible. Annotating your CSS with a simple comment gives your perfect control over which CSS rules are to be considered critical and which ones are not.

If you later decide to no longer support this workflow or switch to a different one (with different tools), the critical-comments are standard CSS and will not break your project.

## Why split the files into 2 seperate files? Why not immediately move it into HTML?
The idea here is that we want to generate our entire CSS file first and then split out what is considered 'critical'.
Injecting it into an HTML file right away would be fairly dictative of your workflow. This allows for more flexible setups.

For example: during development you could `<link>` the critical-CSS file, while rendering it out into the HTML templates once you get ready for production (remember to adjust the URL's in the CSS file for the changed context of the CSS execution).

## Install

```bash
npm install --save-dev postcss-critical-split
```
## Usage

```javascript
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split'));
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

### options.suffix
*defaults to `-critical`*

This is the suffix that will be added to the generated critical-CSS file.

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*.head.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'suffix':'.head'
	}));
```
```css
/* before: main.css */
/* critical:start */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}
/* critical:end */

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
/* after: main.head.css */
header{
	background-color: #1d1d1d;
	font-size: 2em;
}
```


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

## Considerations
* I have only used this plugin myself in a Gulp-driven PostCSS flow. I'm not sure how it behaves elsewhere.
* The plugin currently saves 2 files to disk per given CSS file (overwriting the original file in the process). I haven't used this plugin as part of a larger flow. In my buildflow, it runs as a seperate task before other PostCSS tasks are started.
* This is my first PostCSS plugin. It might just not be best practice; it just worked for me and decided to share what I have. I hope I can at least help a few of you with this.
