# postcss-critical-split
A PostCSS plugin that takes existing CSS files and splits out the annotated critical styles into a seperate file, inspired by  https://github.com/wladston/postcss-split

## What exactly does this plugin do?
* It goes through the given CSS files and finds all rules that have a CSS comment in them that indicates they are critical. These rules are then moved out of the original file and saved into a different file.
* It keeps track of media-queries: If a tagged rule is inside a media query, the media query will be copied to the critical file as well.
* It also works inside @font-face declarations: you can tag @font-face declarations which will be added to the critical-CSS file as well

## What does it NOT do?
* It does not automatically detect which rules should be considered critical. You have to tag them yourself.
* It does not change any paths in the critical ruleset. If you want are to include the critical-CSS file in the head of your site, you WILL need to run another PostCSS to adapt the paths. Check out this example for more info: https://github.com/mrnocreativity/critical-css-example
* Remove the tag-comment you added yourself. This can be removed in a later stage with other capable and proven PostCSS plugins

## Why should I tag my CSS rules myself?
For larger scale projects, automating critical-CSS detection is complicated, unprecise or damn-well impossible. Annotating your CSS with a simple comment gives your perfect control over which CSS rules are to be considered critical and which ones are not.

## Why split the files into 2 seperate files? Why not immediately move it into HTML?
The idea here is that we want to generate our entire CSS file first and then split out what is considered 'critical'. In my build flow, this required me to split some CSS rules out of one file and save them in another CSS file with a slightly different name. You can then render that file in your templates or just `<link>` it during development.

## Install

```bash
npm install --save-dev postcss-critical-split
```
## Usage

```javascript
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split'));
```

## Options
The plugin accepts an object with additional options.

### options.suffix
*defaults to `-critical`*

This is the suffix that will be added to the generated critical-CSS file.

```css
/* before: main.css */
header{
	/*CRITICAL*/
	background-color: #1d1d1d;
	font-size: 2em;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'suffix':'.head'
	}));
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
	/*CRITICAL*/
	background-color: #1d1d1d;
	font-size: 2em;
}
```


### options.pattern
*defaults to `/CRITICAL/`*

This is the pattern that is matched in every rule/atRule in the original CSS file. If a match is found in a rule, the rule is appended to the critical-CSS file and removed in the original file. It is in fact a pattern, so if you're a regex guru, you can probably use this in a few interesting and flexible ways.

```css
/* before: main.css */
header{
	/*FOLD*/
	background-color: #1d1d1d;
	font-size: 2em;
}

footer{
	background-color: #1d1d1d;
	font-size: 1.1em;
}
```

```javascript
/* gulpfile */
gulp.src(['**/*.css','!**/*-critical.css'])
	.pipe(postcss(require('postcss-critical-split')({
		'pattern':'/FOLD/'
	}));
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
	/*FOLD*/
	background-color: #1d1d1d;
	font-size: 2em;
}
```

## Considerations
* I have only used this plugin myself in a Gulp-driven PostCSS flow. I'm not sure how it behaves elsewhere.
* The plugin currently saves 2 files to disk per given CSS file (overwriting the original file in the process). I haven't used this plugin as part of a larger flow. In my buildflow, it runs as a seperate task before other PostCSS tasks are started.
* This is my first PostCSS plugin. It might just not be best practice; it just worked for me and decided to share what I have. I hope I can at least help a few of you with this.
