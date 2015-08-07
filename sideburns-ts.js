var typescript = Npm.require('typescript');
var _eval = Npm.require('eval');
var cheerio = Npm.require('cheerio');

var handler = function (compileStep) {
  var source = compileStep.read().toString('utf8');
  var ts = "", ng = "";

  // Find and start parsing and compiling each templates.
  var parts = source.split(/<template name="(\w+)">/i);
  var extras = parts[0];

  for(var i=1; i <= parts.length-1; i+=2) {
    var selector = parts[i];
    var className = selector.charAt(0).toUpperCase() + selector.slice(1);

    // Split out the trailing end after the template.
    var code = parts[i+1].split(/<\/template>/i);
    var markup = (code[0] || '');

    // Build Angular 2 TypeScript.
    ts += "import {Component, View, bootstrap} from 'angular2/angular2';\n"
    ts += "@Component({\n";
    ts += "  selector: '" + selector + "'\n";
    ts += "})\n";
    ts += "@View({\n";
    ts += "  templateUrl: '" + compileStep.inputPath.replace('.html.ts', '.ng.html') + "'\n";
    ts += "})\n";
    ts += "class " + className + " {}\n";
    ts += "bootstrap(" + className + ");";

    // Cleanup and build NG template.
    ng = markup.replace(/^\n/, '').replace(/^\s{2}/g, '');

    extras += (code[1] || '');
  }

  var ts = ts + extras;

  try {
    var output = typescript.transpile(ts, { module : typescript.ModuleKind.System });
    var moduleName = compileStep.inputPath.replace(/\\/,'/').replace('.html.ts','');
    output = output.replace("System.register([",'System.register("'+moduleName+'",[');

    console.log('\n\n\n');
    console.log(compileStep.inputPath.replace('.html.ts', '.ts'));
    console.log('===================== .html.ts -> .ts');
    var lines = ts.split(/\n/g);
    _.each(lines, function(line, i) {
      console.log((i+1) + '  ', line);
    });

    console.log('\n\n\n');
    console.log(compileStep.inputPath.replace('.html.ts', '.ng.html'));
    console.log('===================== .html.ts -> .ng.html');
    var lines = ng.split(/\n/g);
    _.each(lines, function(line, i) {
      console.log((i+1) + '  ', line);
    });

    // console.log('\n\n\n');
    // console.log(compileStep.inputPath.replace('.html.ts', '.js'));
    // console.log('===================== .ts -> .js');
    // var lines = output.split(/\n/g);
    // // var lines = result.code.split(/\n/g);
    // _.each(lines, function(line, i) {
    //   console.log((i+1) + '  ', line);
    // });
  }
  catch(e) {
    if (e.loc) {
      // TypeScript error.
      compileStep.error({
        message: e.message,
        sourcePath: compileStep.inputPath,
        line: e.loc.line,
        column: e.loc.column
      });

      console.log('\n\n\n');
      console.log(compileStep.pathForSourceMap);
      console.log('===================== .html.ts -> .ts');
      var lines = ts.split(/\n/g);
      _.each(lines, function(line, i) {
        console.log((i+1) + '  ', line);
      });

      return;
    } else {
      throw e;
    }
  }

  compileStep.addJavaScript({
    path: compileStep.inputPath.replace('.html.ts', '.js'),
    sourcePath: compileStep.inputPath,
    data: output
  });

  compileStep.addAsset({
    path : compileStep.inputPath.replace('.html.ts', '.ng.html'),
    sourcePath: compileStep.inputPath,
    data : ng
  });
}

Plugin.registerSourceHandler('html.ts', {
  isTemplate: true
}, handler);
