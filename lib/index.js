"use strict";

// Minified from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
Object.assign||Object.defineProperty(Object,"assign",{enumerable:!1,configurable:!0,writable:!0,value:function(a){"use strict";if(void 0===a||null===a)throw new TypeError("Cannot convert first argument to object");for(var c=Object(a),d=1;d<arguments.length;d++){var e=arguments[d];if(void 0!==e&&null!==e){e=Object(e);for(var f=Object.keys(Object(e)),g=0,h=f.length;h>g;g++){var i=f[g],j=Object.getOwnPropertyDescriptor(e,i);void 0!==j&&j.enumerable&&(c[i]=e[i])}}}return c}});

var fs = require("fs"),
	os = require("os"),
	path = require("path"),
	acorn = require("acorn"),

	parse_options = {
		ecmaVersion: 6,
		onComment: handleComment
	},

	dependency_list = [],
	dependency_tree = [],
	curdep,

	OPTS,
	// escaped specially for win platform, since "\\" would make the reg exp fail
	escaped_path_sep = path.sep.replace(/\\/g, "\\\\"),
	DIR_BASE,
	DIR_HOME = (
		os.homedir ?
			os.homedir() :
			process.env[(process.platform == "win32") ? "USERPROFILE" : "HOME"]
	)
;

// module exports
exports.scan = scan;

// ***********************************

function fileExists(filepath) {
	try {
		if (fs.existsSync(filepath)) {
			return true;
		}
	}
	catch (err) { }
	return false;
}

function isURL(filepath) {
	return /^(https?:)?\/\//.test(filepath);
}

function isDirectory(filepath) {
	var stat = fs.statSync(filepath);
	return stat.isDirectory();
}

function isFile(filepath) {
	var stat = fs.statSync(filepath);
	return stat.isFile();
}

function isFileExcluded(filepath) {
	if (OPTS.excludes.length > 0) {
		return OPTS.excludes.some(function somer(exclude){
				return (new RegExp(exclude)).test(filepath);
			});
	}
	return false;
}

// adapted from: https://github.com/azer/expand-home-dir
function resolveHomeDir(filepath) {
	if (filepath == "~") return DIR_HOME;
	return path.join(DIR_HOME,filepath.slice(2));
}

function fixPath(pathStr) {
	if (!(
		isURL(pathStr) ||
		path.isAbsolute(pathStr)
	)) {
		if (/^~/.test(pathStr)) {
			pathStr = resolveHomeDir(pathStr);
		}
		else if (!(new RegExp("^[" + escaped_path_sep + "]")).test(pathStr)) {
			pathStr = path.join(DIR_BASE,pathStr);
		}
	}
	return pathStr;
}

function validateOptions() {
	if (!(
			OPTS.files != null ||
			OPTS.dirs != null
	)) {
		throw new Error("Missing required option: 'files' or 'dirs'");
	}
	else if (
		OPTS.files != null &&
		(
			OPTS.files === "" ||
			(
				typeof OPTS.files != "string" &&
				!Array.isArray(OPTS.files)
			) ||
			(
				Array.isArray(OPTS.files) &&
				~OPTS.files.indexOf("")
			)
		)
	) {
		throw new Error("'files' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.dirs != null &&
		(
			OPTS.dirs === "" ||
			(
				typeof OPTS.dirs != "string" &&
				!Array.isArray(OPTS.dirs)
			) ||
			(
				Array.isArray(OPTS.dirs) &&
				~OPTS.dirs.indexOf("")
			)
		)
	) {
		throw new Error("'dirs' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.excludes != null &&
		(
			OPTS.excludes === "" ||
			(
				typeof OPTS.excludes != "string" &&
				!Array.isArray(OPTS.excludes)
			) ||
			(
				Array.isArray(OPTS.excludes) &&
				~OPTS.excludes.indexOf("")
			)
		)
	) {
		throw new Error("'excludes' option must specify a single non-empty value, or an array of non-empty values");
	}
	else if (
		OPTS.base_dir != null &&
		(
			OPTS.base_dir === "" ||
			typeof OPTS.base_dir != "string"
		)
	) {
		throw new Error("'base_dir' option must specify a non-empty value");
	}
	else if (
		OPTS.recursive != null &&
		typeof OPTS.recursive != "boolean"
	) {
		throw new Error("'recursive' option must be true/false");
	}
	else if (
		OPTS.full_paths != null &&
		typeof OPTS.full_paths != "boolean"
	) {
		throw new Error("'full_paths' option must be true/false");
	}
	else if (
		OPTS.force_slash_separator != null &&
		typeof OPTS.force_slash_separator != "boolean"
	) {
		throw new Error("'force_slash_separator' option must be true/false");
	}
	else if (
		OPTS.output != null &&
		!(
			OPTS.output === "simple" ||
			OPTS.output === "json"
		)
	) {
		throw new Error("'output' option must be either 'simple' or 'json'");
	}
	else if (
		OPTS.groups != null &&
		typeof OPTS.groups != "boolean"
	) {
		throw new Error("'groups' option must be true/false");
	}
	else if (
		OPTS.ignore != null &&
		(
			typeof OPTS.ignore != "object" ||
			!(
				"missing" in OPTS.ignore ||
				"invalid" in OPTS.ignore
			)
		)
	) {
		throw new Error("'ignore' option must be be an object with 'missing' or 'invalid' specified");
	}
	else if (
		OPTS.ignore.missing != null &&
		typeof OPTS.ignore.missing != "boolean"
	) {
		throw new Error("'ignore.missing' option must be true/false");
	}
	else if (
		OPTS.ignore.missing != null &&
		typeof OPTS.ignore.missing != "boolean"
	) {
		throw new Error("'ignore.missing' option must be true/false");
	}
}

function processOptions() {
	// normalize `OPTS.ignore`
	if (OPTS.ignore == null || OPTS.ignore === false) {
		OPTS.ignore = { missing: false, invalid: false };
	}
	else if (OPTS.ignore === true) {
		OPTS.ignore = { missing: true, invalid: true };
	}

	// verify CLI usage
	validateOptions();

	// normalize options
	if (!OPTS.excludes) {
		OPTS.excludes = [];
	}
	else if (!Array.isArray(OPTS.excludes)) {
		OPTS.excludes = [OPTS.excludes];
	}
	if (OPTS.files && !Array.isArray(OPTS.files)) {
		OPTS.files = [OPTS.files];
	}
	if (OPTS.dirs && !Array.isArray(OPTS.dirs)) {
		OPTS.dirs = [OPTS.dirs];
	}

	// default 'groups' to `true`
	if (!("groups" in OPTS)) {
		OPTS.groups = true;
	}

	// include manually specified files
	if (OPTS.files) {
		processFilesOption();
	}

	// include files from any specified directories
	if (OPTS.dirs) {
		processDirsOption();
	}

	// set dir for resolving relative paths
	if (OPTS.base_dir) {
		DIR_BASE = fixPath(OPTS.base_dir);
	}

	// normalize DIR_BASE
	if (!(new RegExp("[" + escaped_path_sep + "]$")).test(DIR_BASE)) {
		DIR_BASE += path.sep;
	}
}

function validateFile(filepath) {
	try {
		if (!isFileExcluded(filepath)) {
			if (isURL(filepath)) {
				// ensure manually specified URLs get a dependency tree node
				if (!matchDependency(filepath)) {
					dependency_tree.push({ src: filepath, children: [] });
				}
				return true;
			}
			else if (fileExists(filepath)) {
				if (isDirectory(filepath)) {
					return;
				}
				return true;
			}
		}
		else return false;
	}
	catch (err) { }

	if (!OPTS.ignore.missing) {
		throw new Error("Not found: " + filepath);
	}

	return false;
}

function processFilesOption() {
	dependency_list = dependency_list.concat(
		OPTS.files
			.map(fixPath)
			.filter(function filterer(filepath){
				var res = validateFile(filepath);
				if (res == null) {
					OPTS.dirs = OPTS.dirs || [];
					OPTS.dirs.push(filepath);
				}
				return res;
			})
	);
}

function processDirectory(filepath) {
	var files = [], dirs = [], res;

	try {
		res = fs.readdirSync(filepath)
			.map(function mapper(filename){
				return path.join(filepath,filename);
			})
			.forEach(function partition(filepath){
				var res = validateFile(filepath);
				if (res == null) {
					dirs.push(filepath);
				}
				else if (res) {
					files.push(filepath);
				}
				return res;
			});

		dependency_list = dependency_list.concat(files);

		// recurse into any sub-directories found
		if (OPTS.recursive) {
			dirs.forEach(processDirectory);
		}
	}
	catch (err) {
		if (!OPTS.ignore.missing) {
			if (/^Not found:/.test(err.message)) {
				throw err;
			}
			else {
				throw new Error("Not found: " + filepath);
			}
		}
	}
}

function processDirsOption() {
	OPTS.dirs
		.map(fixPath)
		.forEach(processDirectory);
}

function scanFile(filepath) {
	var contents, tokenizer, token;

	// skip non-existent or non-file path
	try {
		if (isURL(filepath) ||
			!(
				fileExists(filepath) &&
				isFile(filepath)
			)
		) { return; }
	}
	catch (err) { return; }

	// match dependency tree node or initialize new
	if (!(curdep = matchDependency(filepath))) {
		curdep = { src: filepath, children: [] };
		dependency_tree.push(curdep);
	}

	// skip already scanned file
	if (curdep.scanned) return;

	// only scan each dependency once
	curdep.scanned = true;

	// read file contents
	contents = fs.readFileSync(filepath,{ encoding: "utf8" });

	// consume all tokens so comments are extracted
	try {
		// prepare tokenizer for file
		tokenizer = acorn.tokenizer(contents,parse_options);

		do {
			token = tokenizer.getToken();
		}
		while (token && token.type != acorn.tokTypes.eof);
	}
	catch (err) {
		if (!OPTS.ignore.invalid) {
			if (/^Invalid:/.test(err.message)) {
				throw err;
			}
			else {
				throw new Error("Invalid: " + filepath + "\n" + err.toString());
			}
		}
	}

	// scan all discovered dependency files
	curdep.children
		.map(function mapper(dep){ return dep.src; })
		.forEach(scanFile);
}

function matchDependency(filepath) {
	return dependency_tree.filter(function filterer(dep){
		return filepath == dep.src;
	})[0];
}

function handleComment(_,text) {
	var re = /^\s*require[ds]?(?:\s*:)?\s*(.*)(?:$|[\r\n])/igm,
		ts_re = /^\/\s+<reference\s+path\s*=\s*['"](.*?)['"]\s*\/>\s*$/g,
		res, node, filepath;

	// find all dependency annotation comments
	while ((res = re.exec(text)) || (res = ts_re.exec(text))) {
		filepath = fixPath(res[1]);

		if (!isFileExcluded(filepath)) {
			if (isURL(filepath) ||
				fileExists(filepath)
			) {
				// match dependency tree node or initialize new
				if (!(node = matchDependency(filepath))) {
					node = { src: filepath, children: [] };
					dependency_tree.push(node);
				}

				// link dependency relationship
				curdep.children.push(node);
			}
			else if (!OPTS.ignore.missing) {
				throw new Error("Not found: " + filepath);
			}
		}
	}
}

function walkTree(tree) {
	var nodes = [];

	// depth-first graph nodes traversal
	tree.forEach(function visit(node) {
		// adapted from: http://en.wikipedia.org/wiki/Topological_sorting#Algorithms
		if (node.marked) {
			throw new Error("Circular dependency not supported: " + node.src);
		}
		if (!node.visited) {
			node.marked = true;
			if (node.children) {
				node.children.forEach(function eacher(n){
					n.parents = n.parents || [];
					n.parents.push(node);
					visit(n);
				});
			}
			node.visited = true;
			delete node.marked;
			delete node.children;
			nodes.unshift(node);
		}
	});

	// calculate depths
	nodes.forEach(function eacher(node){
		node.depth = 0;
		delete node.visited;
		if (node.parents) {
			node.parents.forEach(function eacher(n){
				node.depth = Math.max(n.depth + 1,node.depth);
			});
			delete node.parents;
		}

		// no full paths, so resolve against base-dir
		if (!OPTS.full_paths &&
			node.src.indexOf(DIR_BASE) === 0
		) {
			node.src = node.src.substr(DIR_BASE.length);
		}
		
		// force slash separator, replace it
		if (OPTS.force_slash_separator &&
			!isURL(node.src)
		) {
			node.src = node.src.replace(new RegExp(escaped_path_sep,"g"), "/");
		}
	});

	// sort by depth
	nodes.sort(function sorter(a,b){
		return b.depth - a.depth;
	});

	// group parallel dependencies (by depth)?
	if (OPTS.groups && OPTS.output !== "simple") {
		if (nodes.length > 1) {
			nodes = nodes.slice(1).reduce(function reducer(nodes,node){
				var prev = nodes[nodes.length-1];
				if (Array.isArray(prev) && prev[0].depth === node.depth) {
					prev.push(node);
				}
				else if (prev.depth === node.depth) {
					nodes[nodes.length-1] = [prev,node];
				}
				else {
					nodes.push(node);
				}

				return nodes;
			},[nodes[0]]);
		}
	}

	return nodes;
}

function scan(opts) {
	var deps, output = "";

	// (re)initialize all global state
	dependency_list.length = 0;
	dependency_tree.length = 0;
	curdep = undefined;
	DIR_BASE = process.cwd();

	// make a copy of specified options
	OPTS = Object.assign({},opts);

	processOptions();

	// recursively scan all dependencies to build tree
	dependency_list.forEach(scanFile);

	// walk dependency tree for ordered list of dependencies
	deps = walkTree(dependency_tree);

	// handle output options
	if (OPTS.output === "simple") {
		deps.forEach(function eacher(item){
			if (Array.isArray(item)) item.forEach(eacher);
			else output += item.src.replace(/(\s)/g,"\\$1") + "\0";
		});
	}
	else {
		output = JSON.stringify(deps,function replacer(key,value){
			if (typeof value == "object") {
				if (Array.isArray(value)) return value;
				return value.src;
			}
			else if (key === "src") return value;
		});
		output += "\n";
	}

	return output;
}
