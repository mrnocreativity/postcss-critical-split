var postcss = require('postcss');


module.exports = function(criticalSplit, input, output, opts) {
	spyOn(console, 'error').and.callFake(function(message){
		// do nothing
	});

	return postcss([criticalSplit(opts)]).process(input)
		.then( function(result) {
			expect(console.error).toHaveBeenCalledTimes(1);
		});
}
