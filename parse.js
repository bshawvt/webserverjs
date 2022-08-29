// todo?
function Parse(text) {
	this.data = text;
};
Parse.prototype.get = function() {
	return this.data;
};

if (typeof module!=="undefined")
	module.exports = { Parse }