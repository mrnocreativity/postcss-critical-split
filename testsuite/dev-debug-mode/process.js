var postcss = require('postcss');


module.exports = function(criticalSplit, input, output, opts) {
	spyOn(console, 'log').and.callFake(function(message){
		// do nothing
	});

	return postcss([criticalSplit(opts)]).process(input)
		.then( function(result) {
			expect(console.log).toHaveBeenCalledTimes(1);
		});
}
