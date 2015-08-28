var _eval = Npm.require('eval');
var cheerio = Npm.require('cheerio');

var handler = function (compileStep) {
  var source = compileStep.read().toString('utf8');
  var jsx = "var Template = Template || {};";
  var eventMaps = {};

  // Split out event maps.
  var _eventMaps = source.split(/Template\.([^\.]+)\.events\(\{/i);
  for(var i = 1; i <= _eventMaps.length-1; i+=2) {
    var className = _eventMaps[i];
    // Split out the trailing end after the Template.Name.events.
    var _eventMap = (_eventMaps[i+1] + '').split(/\n\}\)/i);
    _eventMap = (_eventMap[0] || '').trim();
    if (_eventMap) {
      try {
        var jsxEventMap = Babel.transformMeteor('module.exports = {' + _eventMap + '};', {
          sourceMap: false,
          extraWhitelist: ["react"]
        });
      } catch(e) {
        if (e.loc) {
          // Babel error
          compileStep.error({
            message: e.message,
            sourcePath: compileStep.inputPath,
            line: e.loc.line,
            column: e.loc.column
          });
          return;
        } else {
          throw e;
        }
      }
      var mapContent = jsxEventMap.code;
      if (mapContent) {
        var res = _eval(mapContent);
        if (typeof res == 'object') {
          eventMaps[className] = eventMaps[className] || {};
          _.extend(eventMaps[className], res);
          eventMaps[className].string = _eventMap;
        }
      }
    }
  }

  // Find and start parsing and compiling each templates.
  var parts = source.split(/<template name="(\w+)">/i);
  var extras = parts[0];
  for(var i=1; i <= parts.length-1; i+=2) {
    var className = parts[i];
    jsx += "Template." + className + " = {\n";
    jsx += "  _extend: {},\n";
    jsx += "  _instance: {},\n";
    jsx += "  onCreated: function(f) {return this._onCreated = f || (this._onCreated || function(){})},\n";
    jsx += "  helpers: function(o) {return this._helpers = o || (this._helpers || {})},\n";
    jsx += "  extend: function(o) {return _.extend(this._extend, o || {})},\n";
    jsx += "  events: function() {}\n"; // Ignore, injected below.
    jsx += "};\n";
  }
  for(var i=1; i <= parts.length-1; i+=2) {
    var className = parts[i];

    // Split out the trailing end after the template.
    var code = parts[i+1].split(/<\/template>/i);
    var markup = (code[0] || '');

    /* INJECT EVENTS */
    if (eventMaps[className]) {
      markup = markup.replace(/<((?!br)[^\>]+)\/>/ig, '<$1></$1>');
      for(var key in _.omit(eventMaps[className], 'string')) {
        var selectors = key.split(',');
        for(var j=0; j < selectors.length; j++) {
          var selector = selectors[j].trim().split(/\s(.+)?/);
          var event = selector[0];
          var select = selector[1];
          var $ = cheerio.load(markup);
          // Get the react event name or use custom name.
          var eventName = ReactEvents[event] ? ReactEvents[event] : event;
          // Remove duplicate listeners.
          $(select).removeAttr(eventName);
          // Append new listener.
          $(select).attr(eventName, "{eventHandler.bind(__component, '" + key + "', typeof context != 'undefined' ? context : (this.data ? this.data : this))}");
          markup = $.html();
        }
      }
      // Cheerio adds qoutes on all attributes, React don't want that so we have to remove those quotes.
      markup = markup.replace(/"({[^"}]+})"/g, '$1');
    }

    /* START SPACEBARS */

    // Add return and key={index} inside {{#each}}.
    markup = markup.replace(/({{#each\s+[^}]+}}[^<]*)(<\w+)/g, '$1return ($2 key={index}');
    // {{#each}} in
    markup = markup.replace(/{{#each\s+([^\s]+)\s+in\s+([^}]+)\s*}}/g, "{(Sideburns.check(context, '$2')? context.$2 : []).map(function($1, index){let context=__component.data;context.$1=$1");
    // {{/each}}
    markup = markup.replace(/{{\/each}}/g, ");})}");

    // ^{{#if}}
    markup = markup.replace(/^\W*{{#if\s+(\w+)\s*}}/g, "<span>{Sideburns.check(context, '$1')?(");
    // {{/if}}$
    markup = markup.replace(/{{\/if}}\W*$/g, "):''}</span>");
    // {{#if}}
    markup = markup.replace(/{{#if\s+(\w+)\s*}}/g, "{Sideburns.check(context, '$1')?(");
    // {{else}} {{/if}}
    markup = markup.replace(/(?:{{else}}(?![\w\W]*{{else}}))([\w\W]*){{\/if}}/g, "):($1)}");
    // {{/if}}
    markup = markup.replace(/{{\/if}}/g, "):''}");

    // ^{{#unless}}
    markup = markup.replace(/^\W*{{#unless\s+(\w+)\s*}}/g, "<span>{!Sideburns.check(context, '$1')?(");
    // {{/unless}}$
    markup = markup.replace(/{{\/unless}}\W*$/g, "):''}</span>");
    // {{#unless}}
    markup = markup.replace(/{{#unless\s+(\w+)\s*}}/g, "{!Sideburns.check(context, '$1')?(");
    // {{else}} {{/unless}}
    markup = markup.replace(/(?:{{else}}(?![\w\W]*{{else}}))([\w\W]*){{\/unless}}/g, "):($1)}");
    // {{/unless}}
    markup = markup.replace(/{{\/unless}}/g, "):''}");

    // {{helper}} raw HTML
    markup = markup.replace(/{{{([^}]*)}}}/g, "{Sideburns.check(context, '$1')? context.data.$1 : ''}");

    // {{helper}} SafeString – Dynamic Attribute (class)
    markup = markup.replace(/\sclass={{([^}]*)}}/g, " className={Sideburns.check(context, '$1')? new Sideburns.classNames(context.$1) : ''}");

    // {{helper}} SafeString – Dynamic Attribute (other)
    markup = markup.replace(/={{([^}]*)}}/g, "={Sideburns.check(context, '$1')? new Sideburns.SafeString(context.$1) : ''}");

    // {{helper}} SafeString – In Attribute Values (class)
    markup = markup.replace(/\sclass="([^\"{]*){{([^}]*)}}([^\"{]*)\"/g, " className={Sideburns.check(context, '$2')? '$1' + new Sideburns.classNames(context.$2) + '$3' : ''}");

    // {{helper}} SafeString – In Attribute Values (other)
    markup = markup.replace(/="([^\"{]*){{([^}]*)}}([^\"{]*)\"/g, "={Sideburns.check(context, '$2')? '$1' + new Sideburns.classNames(context.$2) + '$3' : ''}");

    // {{helper}} SafeString
    markup = markup.replace(/{{([^}]*)}}/g, "{Sideburns.check(context, '$1')? new Sideburns.SafeString(context.$1) : ''}");

    /* END SPACEBARS */

    // Fix that annoying issue with React, and allow usage of class.
    markup = markup.replace(/\sclass=/g, ' className=');

    // Fix that annoying issue with React, and allow usage of for.
    markup = markup.replace(/\sfor=/g, ' htmlFor=');

    // ES2015 Template for React components.
    jsx += "Template." + className + "._instance = {displayName: \"" + className + "\",\n";
    jsx += "  _created: false,\n";
    jsx += "  mixins: [ReactMeteorData],\n";
    if (eventMaps[className]) {
      jsx += "  events: {" + eventMaps[className].string + "},\n";
    }
    jsx += "  getInitialState: function() {_.extend(this, _.omit(Template." + className + "._extend, 'getInitialState')); return Template." + className + "._extend.getInitialState ? Template." + className + "._extend.getInitialState.call(this) : null;},\n";
    jsx += "  getMeteorData() {\n";
    jsx += "    let self = this;\n";
    jsx += "    if (!self._created) {\n";
    jsx += "      Tracker.nonreactive(function(){Template." + className + ".onCreated().call(self)});\n";
    jsx += "      self._created = true;\n";
    jsx += "    }\n";
    jsx += "    let _helpers = {};\n";
    jsx += "    let helpers = Template." + className + ".helpers();\n";
    jsx += "    for (let key in helpers) {\n";
    jsx += "      _helpers[key] = helpers[key].call(self);\n";
    jsx += "    };\n";
    jsx += "    return _helpers;\n";
    jsx += "  },\n";
    jsx += "  render: function() {\n";
    jsx += "    let __component = this;";
    jsx += "    let context = this.data;";
    jsx += "    function eventHandler(key,context,event){";
    jsx += "        __component.events[key].call(this,event,context);";
    jsx += "    }";
    jsx += "    return (" + markup + ");";
    jsx += "  }\n";
    jsx += "};\n";
    jsx += className + " = React.createClass(Template." + className + "._instance);";
    extras += (code[1] || '');
  }

  var reactJsx = jsx + extras;
  var outputFile = compileStep.inputPath + ".jsx";

  // Capture jsx failures in compiling.
  try {
    var result = Babel.transformMeteor(reactJsx, {
      sourceMap: true,
      filename: compileStep.pathForSourceMap,
      sourceMapName: compileStep.pathForSourceMap,
      extraWhitelist: ["react"]
    });
  } catch (e) {
    if (e.loc) {
      // Babel error
      compileStep.error({
        message: e.message,
        sourcePath: compileStep.inputPath,
        line: e.loc.line,
        column: e.loc.column
      });

      console.log('\n\n\n');
      console.log(compileStep.pathForSourceMap);
      console.log('=====================');
      var lines = (jsx + extras).split(/\n/g);
      _.each(lines, function(line, i) {
        console.log((i+1) + '  ', line);
      });

      return;
    } else {
      throw e;
    }
  }

  compileStep.addJavaScript({
    path: outputFile,
    sourcePath: reactJsx,
    data: result.code,
    sourceMap: JSON.stringify(result.map)
  });
};

Plugin.registerSourceHandler('html.jsx', handler);
