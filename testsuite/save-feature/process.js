var postcss = require('postcss'),
	fs = require('fs');


module.exports = function(criticalSplit, input, output, opts) {
	spyOn(console, 'warn').and.callFake(function(message){
		// do nothing
	});

	spyOn(fs, 'writeFileSync').and.callFake(function(path, data) {
		return true;
	});

	return postcss([criticalSplit(opts)]).process(input)
		.then( function(result) {
			expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
		});
}
