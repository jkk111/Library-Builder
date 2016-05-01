var fs = require("fs");
var libraryDir, options;


if (!module.parent) {
  standalone();
} else {
  module.exports = init;
}

function buildLibrary(libRoot, cb) {
  var _root = "{";
  var hasEntry = false;
  var baseName = getDirName(libRoot);
  if(libRoot.charAt(libRoot.length -1) != "/")
    libRoot += "/";
  var rootName = libRoot.substring(0, libRoot.length - 1);
  var rootObj = handleDirectory(options.dir + libRoot, true);
  var stringified = stringify_object(rootObj, options.minified == true ? undefined : options.delimiter || "  ");
  if(cb) {
    cb(null, stringified);
  }
  else {
    fs.writeFileSync(`${__dirname + "/"+ baseName}.js`,
                    `var ${baseName} = ${stringified};\n${genInit(baseName)};`);
    console.log("successfully wrote to:", __dirname + "/" + libRoot.substring(0, libRoot.length - 1) + ".js");
  }
}

function duplicateKeys(dest, src, overwrite) {
  if(typeof src === "object" && typeof dest === "object" && !Array.isArray(src) && !Array.isArray(dest)) {
    var keys = Object.keys(src);
    for(var i = 0 ; i < keys.length; i++) {
      var key = keys[i];
      if(overwrite) {
        dest[key] = src[key];
      } else {
        dest[key] = dest[key] || src[key];
      }
    }
  }
}

function formatFunction(array, divider, depth, lb) {
  var str = "";
  // Indentation of the closing brace of the function
  var baseLine;
  if(array.length > 1) {
    baseLine = getLeadingWhitespace(array[array.length -1]);
  }
  for(var i = 0 ; i < array.length; i++) {
    var selfDepth = getLeadingWhitespace(array[i], depth);
    if(i == 0) {
      if(divider)
        str += array[i];
      else
        str += array[i].trim();
    }
    else {
      str += getDivider(divider, depth, lb) +
             // Second get divider compensates for functions indentation
             getDivider(divider == undefined ? "" :
                        divider, Math.ceil((selfDepth - baseLine) / whiteSpaceValue(divider)), false) +
                        (array[i].trim());
    }
  }
  return str;
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

function getDivider(divider, depth, lb) {
  if(!divider)
    return "";
  var str = "";
  if(lb)
    str += "\n";
  for (var i = 0; i < depth; i++) {
    str += divider;
  }
  return str;
}

function getLeadingWhitespace(line, d) {
  var patt = /(\t| )/;
  var count = 0;
  while(line.charAt(0).match(patt)) {
    if(line.charAt(0) === "\t")
      count += optiosn.tabSize || 4;
    else
      count++;
    line = line.substring(1);
  }
  return count;
}

function getNameEnding(name) {
  return name.substring(name.length - 3)
}

function genInit(baseName) {
  return `if(${baseName}.init && ${baseName}.init.ready && typeof ${baseName}.init.ready === "function") {
  ${baseName}.init.ready();
}`
}

function handleDirectory(path_to_dir, isRoot) {
  var _root = {};
  try {
    if(path_to_dir.charAt(path_to_dir.length -1) != "/")
      path_to_dir += "/";
    var files = fs.readdirSync(path_to_dir);
    for(var i = 0 ; i < files.length; i++) {
      var filename = files[i];
      var path_to_file = path_to_dir + filename;
      var stats = fs.statSync(path_to_file);

      if(stats.isDirectory()) {
        var dir = handleDirectory(path_to_dir + filename, false);
        if(dir && !dir.error) {
          if(_root[filename]) {
            duplicateKeys(_root[filename], dir, true);
          }
          else {
            _root[filename] = dir;
          }
        }
      } else {
        var file = handleFile(path_to_file, true)
        if(file && !file.error) {
          if(_root[getBaseName(filename)]) {
            duplicateKeys(_root[getBaseName(filename)], file, true);
          }
          else {
            _root[getBaseName(filename)] = file;
          }
        }
      }
    }
    return _root;
  } catch(e) {
    console.log(e, "handle dir");
    return {error: e};
  }
}

function handleFile(path_to_file, selfEval) {
  if(getNameEnding(path_to_file) != ".js") return;
  try {
    var filestr = fs.readFileSync(path_to_file, "utf8");
    if(filestr.indexOf("function") != 0)
      filestr = filestr.substring(filestr.indexOf("{"));
    var file;
    eval(`file = ${filestr}`);
    return file;
  } catch(e) {
    console.error("Could not parse file: ", getDirName(path_to_file), e);
    return {error: e}
  }
}

function handleStringifyValue(key, value, divider, depth, lb) {
  if(typeof value === "object")
   return stringify_object(value, divider, depth + 1, lb);
  else if(typeof value === "function")
    return formatFunction(value.toString().split("\n"), divider, depth, lb);
  else
    return value;
}

function init(_options) {
  options = _options || {};
  options.dir = options.dir || "library/";
  options.minified = options.minified || false;
  if(options.dir.charAt(options.dir.length - 1) != "/")
    options.dir += "/"
  return buildLibrary;
}

function standalone() {
  var options;
  try { options = JSON.parse(fs.readFileSync("options.json")); } catch(e) {console.log(e);}
  init(options)(process.argv[2]);
}

function stringify_object(o, divider, depth, lb) {
  depth = depth || 1;
  if(lb === undefined)
    lb = divider !== undefined;
  var stringified = Array.isArray(o) ? "[" : "{";
  var first = true;
  for(key in o) {
    if(!first)
      stringified += ",";
    if(Array.isArray(o))
      stringified += getDivider(divider, depth, lb) + handleStringifyValue(key, o[key], divider, depth, lb);
    else
      stringified += getDivider(divider, depth, lb) + `'${key}': ${handleStringifyValue(key, o[key], divider, depth, lb)}`;
    first = false;
  }
  if(depth > 0)
    stringified += getDivider(divider, depth - 1, lb);
  stringified += Array.isArray(o) ? "]" : "}";
  return stringified;
}

function whiteSpaceValue(delimiter) {
  if(!delimiter) return 0;
  var val = 0;
  for(var i = 0 ; i < delimiter.length; i++) {
    var char = delimiter.charAt(i);
    if(char === "\t") {
      val += 4;
    } else {
      val += 1;
    }
  }
  return val;
}