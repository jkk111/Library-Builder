var fs = require("fs");
var app = require("express")();
var libraryDir, build, options;

module.exports = function(_options) {
	options = _options || {};
  options.path = (options.path  || "/library_builder") + "/:root";
  options.dir = options.dir || "library/";
  options.maxAge = options.maxAge || 0;
  if(options.dir.charAt(options.dir.length - 1) != "/")
    options.dir += "/"
  app.get(options.path, function(req, res, next) {
    var libRoot = req.params.root;
    buildLibrary(libRoot, function(err, result) {
      if(err) return res.status(500).send("Error generating library!");
      res.send(result);
    })
  });
  // buildLibrary("john", function(e) {
  //   console.log(e == undefined ? "success" : "failure");
  //   process.exit();
  // })
  return app;
}

function formatFunction(array, divider, depth) {
  var tmp = depth;
  console.log(tmp, "localherre");
  var str = "";
  var baseLine;
  if(array.length > 1) {
    baseLine = getLeadingWhitespace(array[array.length -1]);
  }
  for(var i = 0 ; i < array.length; i++) {
    var selfDepth = getLeadingWhitespace(array[i], depth);
    if(i == 0)
      str += array[i];
    else {
      str += "\n" + getDivider(divider, depth) + getDivider(" ", selfDepth - baseLine) + (array[i].trim());
    }
  }
  return str;
}

function getDivider(divider, depth) {
  var str = "";
  for (var i = 0; i < depth; i++) {
    str += divider;
  }
  return str;
}

function handleStringifyValue(key, value, divider, depth) {
  if(typeof value === "object")
   return stringify_object(value, divider, depth + 1);
  else if(typeof value === "function")
    return formatFunction(value.toString().split("\n"), divider, depth);
  else
    return value;
}

function stringify_object(o, divider, depth) {
  depth = depth || 1;
  var stringified = Array.isArray(o) ? "[" : "{";
  var first = true;
  console.log("DEPTH" + depth);
  for(key in o) {
    if(!first)
      stringified += ",";
    if(Array.isArray(o))
      stringified += "\n" + getDivider(divider, depth) + handleStringifyValue(key, o[key], divider, depth);
    else
      stringified += "\n" + getDivider(divider, depth) + `'${key}': ${handleStringifyValue(key, o[key], divider, depth)}`;
    first = false;
  }
  if(divider)
    stringified += "\n";
  if(depth > 0)
    stringified += getDivider(divider, depth - 1);
  stringified += Array.isArray(o) ? "]" : "}";
  return stringified;
}

function buildLibrary(libRoot, cb) {
  if(build && build.time + options.maxAge > (new Date().getTime())) {
    console.log("cached");
    cb(null, build.data);
  } else {
    var _root = "{";
    var hasEntry = false;
      if(libRoot.charAt(libRoot.length -1) != "/")
        libRoot += "/";
      var rootName = libRoot.substring(0, libRoot.length - 1);
      var selfEval;
      console.log("here");
      var dat = handleDirectory(options.dir + libRoot, true);
      console.log(dat);
      fs.writeFileSync("pre.js", handleDirectory(options.dir + libRoot, true));
      eval(`selfEval = ${handleDirectory(options.dir + libRoot, true)}`);
      console.log("and here")
      fs.writeFileSync("selfEval.js", stringify_object(selfEval, "  "));
      return cb(null, `var ${rootName} = ${stringify_object(selfEval, "  ")}`)
      var _root = `var ${rootName} = ${selfEval}`;
      build = { time: new Date().getTime(), data: `eval(\`${_root}\`);
                if(${rootName}.init && typeof ${rootName}.init === "function") {
                  ${rootName}.init();
                }
                else if(${rootName}.init && ${rootName}.init.ready && typeof ${rootName}.init.ready == "function") {
                  ${rootName}.init.ready();
                }`}
      cb(null, build.data);
  }
}

function handleDirectory(path_to_dir, isRoot) {
  var _root = "{";
  var hasEntry = false;
  try {
    if(path_to_dir.charAt(path_to_dir.length -1) != "/")
      path_to_dir += "/";
    var files = fs.readdirSync(path_to_dir);
    for(var i = 0 ; i < files.length; i++) {
      if(hasEntry) _root += ", ";
      var filename = files[i];
      console.log(filename);
      var path_to_file = path_to_dir + filename;
      var stats = fs.statSync(path_to_file);
      if(stats.isDirectory()) {
        var dir = handleDirectory(path_to_dir + filename, false);
        if(dir && !dir.error) {
          _root += `'${filename}': ${dir}`;
        }
      } else {
        var file = handleFile(path_to_file, true)
        if(file && !file.error) {
          // _root[filename] = file;
          _root += `'${getBaseName(filename)}': ${file}`
        }
      }
      hasEntry = true;
    }
    // if(isRoot)
    //   console.log("here dir", dir);
    _root += "}";
    if(!isRoot) {
      // _root = `'${getDirName(path_to_dir)}': ${_root}`;
    }
    return _root;
  } catch(e) {
    console.log(e, "handle dir");
    return {error: e};
  }
}

function getLeadingWhitespace(line, d) {
  var patt = /(\t| )/;
  var count = 0;
  while(line.charAt(0).match(patt)) {
    if(line.charAt(0) === "\t")
      count += 4;
    else
      count++;
    line = line.substring(1);
  }
  console.log(count, "CONT", d, line);
  return count;
}

function handleFile(path_to_file, selfEval) {
  if(getNameEnding(path_to_file) != ".js") return;
  try {
    var filestr = fs.readFileSync(path_to_file, "utf8");
    if(filestr.indexOf("function") != 0)
      filestr = filestr.substring(filestr.indexOf("{"));
    if(!selfEval)
      filestr = filestr.replace(/\\/g, "\\\\");
    return filestr.replace(/\"/g, "'");
  } catch(e) {
    console.log(e, "handleFile");
    return {error: e}
  }
}

function getNameEnding(name) {
  return name.substring(name.length - 3)
}

function getBaseName(name) {
  return name.substring(name.lastIndexOf("/") , name.length - 3);
}

function getDirName(name) {
  while(name.charAt(name.length -1) == "/") {
    name = name.substring(0, name.length -1);
  }
  return name.substring(name.lastIndexOf("/") + 1);
}