// Build out Handlebars basic SafeString type
Sideburns.SafeString = function(string) {
  this.string = string;
}
Sideburns.SafeString.prototype.toString = Sideburns.SafeString.prototype.toHTML = function() {
  return '' + this.string;
};

Sideburns.classNames = function(obj) {
  this.obj = obj;
}
Sideburns.classNames.prototype.toString = Sideburns.classNames.prototype.toHTML = function() {
  return '' + new Sideburns.SafeString(Sideburns._classNames(this.obj));
};

Sideburns.check = function(context, string) {
  var string = string.trim();
  var tests = string.split('.');
  if (!context) {
    return false;
  }
  var obj = context;
  _.each(tests, function(test) {
    if (!obj) {
      return false;
    }
    obj = obj[test];
    if (!obj || !_.has(obj, string)) {
      return false;
    }
  });
  return obj;
}
