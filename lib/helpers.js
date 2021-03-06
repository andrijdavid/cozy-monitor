// Generated by CoffeeScript 1.9.0
var ControllerClient, config, controllerUrl, couchUrl, couchdbHost, couchdbPort, dataSystemUrl, exec, fs, getAuthCouchdb, getToken, homeUrl, log, path, postfixHost, postfixPort, postfixUrl, proxyUrl, readToken, request, token, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;

fs = require("fs");

log = require('printit')();

request = require("request-json-light");

exec = require('child_process').exec;

path = require('path');

try {
  config = JSON.parse(fs.readFileSync('/etc/cozy/controller.json', 'utf8'));
} catch (_error) {}

couchdbHost = process.env.COUCH_HOST || (config != null ? (_ref = config.env) != null ? (_ref1 = _ref['data-system']) != null ? _ref1.COUCH_HOST : void 0 : void 0 : void 0) || 'localhost';

couchdbPort = process.env.COUCH_PORT || (config != null ? (_ref2 = config.env) != null ? (_ref3 = _ref2['data-system']) != null ? _ref3.COUCH_PORT : void 0 : void 0 : void 0) || '5984';

postfixHost = process.env.POSTFIX_HOST || 'localhost';

postfixPort = process.env.POSTFIX_PORT || '25';

module.exports.dbName = process.env.DB_NAME || (config != null ? (_ref4 = config.env) != null ? (_ref5 = _ref4['data-system']) != null ? _ref5.DB_NAME : void 0 : void 0 : void 0) || 'cozy';

couchUrl = "http://" + couchdbHost + ":" + couchdbPort + "/";

dataSystemUrl = "http://localhost:9101/";

controllerUrl = "http://localhost:9002/";

homeUrl = "http://localhost:9103/";

proxyUrl = "http://localhost:9104/";

postfixUrl = "http://" + postfixHost + ":" + postfixPort + "/";

ControllerClient = require("cozy-clients").ControllerClient;

readToken = function(file) {
  var err, token;
  try {
    token = fs.readFileSync(file, 'utf8');
    token = token.split('\n')[0];
    return token;
  } catch (_error) {
    err = _error;
    log.info("Cannot get Cozy credentials. Are you sure you have the rights to access to:\n/etc/cozy/stack.token ?");
    return null;
  }
};

getToken = module.exports.getToken = function() {
  if (fs.existsSync('/etc/cozy/stack.token')) {
    return readToken('/etc/cozy/stack.token');
  } else {
    if (fs.existsSync('/etc/cozy/controller.token')) {
      return readToken('/etc/cozy/controller.token');
    } else {
      return null;
    }
  }
};

getAuthCouchdb = module.exports.getAuthCouchdb = function(exit) {
  var data, error, password, username;
  if (exit == null) {
    exit = true;
  }
  try {
    data = fs.readFileSync('/etc/cozy/couchdb.login', 'utf8', function(err, data) {});
    username = data.split('\n')[0];
    password = data.split('\n')[1];
    return [username, password];
  } catch (_error) {
    error = _error;
    log.error("Cannot read database credentials in /etc/cozy/couchdb.login.");
    if (exit) {
      return process.exit(1);
    } else {
      return ['', ''];
    }
  }
};

module.exports.makeError = function(err, body) {
  if (err != null) {
    return new Error(err);
  } else if (body != null) {
    if (body.msg) {
      return new Error(body.msg);
    } else if (body.message) {
      return new Error(body.message);
    } else if (body.error) {
      return new Error(body.error);
    }
  }
};

module.exports.logError = function(err, msg, doExit) {
  if (doExit == null) {
    doExit = true;
  }
  log.error("An error occured:");
  if (msg != null) {
    log.error(msg);
  }
  log.raw(err);
  if (doExit) {
    return process.exit(1);
  }
};

module.exports.handleError = function(err, body, msg) {
  log.error("An error occured:");
  if (err) {
    log.raw(err);
  }
  log.raw(msg);
  if (body != null) {
    if (body.msg != null) {
      log.raw(body.msg);
    } else if (body.error != null) {
      if (body.error.message != null) {
        log.raw(body.error.message);
      }
      if (body.message != null) {
        log.raw(body.message);
      }
      if (body.error.result != null) {
        log.raw(body.error.result);
      }
      if (body.error.code != null) {
        log.raw("Request error code " + body.error.code);
      }
      if (body.error.blame != null) {
        log.raw(body.error.blame);
      }
      if (typeof body.error === "string") {
        log.raw(body.error);
      }
    } else {
      log.raw(body);
    }
  }
  return process.exit(1);
};

token = getToken();

module.exports.clients = {
  'home': request.newClient(homeUrl),
  'couch': request.newClient(couchUrl),
  'ds': request.newClient(dataSystemUrl),
  'data-system': request.newClient(dataSystemUrl),
  'proxy': request.newClient(proxyUrl),
  'controller': new ControllerClient({
    token: token
  }),
  'postfix': request.newClient(postfixUrl),
  'mta': request.newClient(postfixUrl)
};

module.exports.retrieveManifestFromDisk = function(app, callback) {
  var basePath, command, fullAppName, manifest, manifestPath, moduleDirectory;
  basePath = path.join('/usr/local/cozy/apps', app);
  manifestPath = path.join(basePath, 'package.json');
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.name === 'cozy-controller-fake-package.json') {
    moduleDirectory = path.join(basePath, 'node_modules');
    if (app === 'data-system' || app === 'home' || app === 'proxy' || app === 'calendar' || app === 'contacts' || app === 'emails' || app === 'files') {
      fullAppName = "cozy-" + app;
    } else {
      fullAppName = app;
    }
    manifestPath = path.join(moduleDirectory, fullAppName, 'package.json');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest["package"] = manifest.name;
    return callback(null, manifest);
  } else {
    command = "cd " + basePath + " && git config --get remote.origin.url";
    return exec(command, function(err, body) {
      if (err != null) {
        return callback(err);
      }
      manifest.repository = {
        type: 'git',
        url: body.replace('\n', '')
      };
      command = "cd " + basePath + " && git rev-parse --abbrev-ref HEAD";
      return exec(command, function(err, body) {
        if (err != null) {
          return callback(err);
        }
        manifest.repository.branch = body.replace('\n', '');
        return callback(null, manifest);
      });
    });
  }
};
