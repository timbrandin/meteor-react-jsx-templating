Package.describe({
  name: 'timbrandin:sideburns',
  version: '0.3.0',
  // Brief, one-line summary of the package.
  summary: 'React templates for Meteor',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/timbrandin/meteor-react-sideburns',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.registerBuildPlugin({
  name: 'html.jsx',
  use: [
    'underscore@1.0.3',
    'babel-compiler@5.4.7',
    'cosmos:browserify@0.4.0',
  ],
  sources: [
    'react-events.js',
    'sideburns-jsx.js'
  ],
  npmDependencies: {
    'cheerio': '0.7.0',
    'eval': '0.1.0'
  }
});

Package.registerBuildPlugin({
  name: 'html.ts',
  use: [
    'underscore@1.0.3',
    'cosmos:browserify@0.4.0',
    'html-tools@1.0.4'
  ],
  sources: [
    'angular-events.js',
    'sideburns-ts.js'
  ],
  npmDependencies: {
    'typescript' : '1.5.0-beta',
    'html-minifier' : '0.6.9',
    'cheerio': '0.7.0',
    'eval': '0.1.0'
  }
});

Npm.depends({
  "classnames": "2.1.3"
});

Package.onUse(function (api) {
  // We need the Babel helpers for React as a run-time dependency of the generated code.
  api.use('babel-runtime@0.1.0', ['client', 'server'], {weak: true});
  api.use('react-meteor-data@0.1.0', ['client', 'server'], {weak: true});

  api.use(['cosmos:browserify@0.4.0'], 'client');
  api.imply([
    'cosmos:browserify@0.4.0'
  ]);

  api.addFiles([
    'classnames-server.js',
    'sideburns-export.js'
  ], 'server');

  api.addFiles([
    'client.browserify.js',
    'sideburns-export.js'
  ], 'client');

  api.export('Sideburns');
});
