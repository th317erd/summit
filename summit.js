/* 	summit.js
	SummIT.js: Node.js JavaScript utilities. Written by Wyatt Greenway.
	Copyright Wyatt Greenway 2013
*/
Σ_util = require("util");
Σ_cluster = require("cluster");

function Σ_call(func, context, args) {
	if (typeof func == 'function') {
		return func.apply(context, (args === undefined) ? [] : args);
	}
}

function Σ_overload(x, items, context) {
	var type_str = typeof x;

	if (x === null) type_str = 'default'; //Special case (null is an Object)

	if (x instanceof Object) {
		if (x instanceof Array) type_str = 'array';
		if (x instanceof Array) type_str = 'object';
		if (x instanceof Function) type_str = 'function';
	}

	if (items[type_str] !== undefined) {
		return Σ_call(items[type_str], (context !== undefined) ? context : this);
	}

	return Σ_call(items['default'], (context !== undefined) ? context : this);
}

function Σ_empty() {
	var is_empty;
	for (var i = 0; i < arguments.length; i++) {
		Σ_overload(arguments[i], {
			'object': function() {
				is_empty = (Object.keys(this).length == 0);
			},
			'string': function() {
				is_empty = (this.length == 0);
			},
			number: function() {
				is_empty = (this == 0);
			},
			'default': function() {
				is_empty = !(!this);
			}
		});

		if (is_empty) return true;
	}

	return false;
}

function Σ_each(obj, func) {
	if (obj === undefined || func === undefined) return;

	if (obj instanceof Object && !(obj instanceof Function)) {
		if (obj instanceof Array) {
			for (var i = 0; i < obj.length; i++) {
				if (Σ_call(func, obj, [i, obj[i]]) === false) break;
			}
		} else {
			var keys = Object.keys(obj);
			for (var i = 0; i < keys.length; i++) {
				if (Σ_call(func, obj, [keys[i], obj[keys[i]]]) === false) break;
			}
		}
	} else {
		Σ_call(func, obj, [typeof obj, obj]);
	}
}

function Σ_walk(obj, func) {
	Σ_each(obj, function(k, v) {
		Σ_overload(v, {
			'object': function() {
				return Σ_walk(v, func);
			},
			'array': function() {
				return Σ_walk(v, func);
			},
			'default': function() {
				return Σ_call(func, obj, [k, v]);
			}
		});
	});
}

function Σ_extend(dst) {
	var skip_first = false;

	Σ_each(arguments, function(k, v) {
		if (skip_first == false) {
			skip_first = true;
			return true;
		}

		Σ_each(v, function(ok, ov) {
			Σ_overload(ov, {
				'object': function() {
					if (dst[ok] === undefined) dst[ok] = {};
					Σ_extend(dst[ok], ov);
				},
				'array': function() {
					if (dst[ok] === undefined) dst[ok] = [];
					Σ_extend(dst[ok], ov);
				},
				'default': function() {
					dst[ok] = ov;
				}
			});
		});
	});

	return dst;
};

function Σ_converter(type) {
	if (type === undefined) return;
	var this_type = ("" + type).toLowerCase();

	type_funcs = {
		"lower_case": function(v) {
			return ("" + v).toLowerCase();
		},
		"upper_case": function(v) {
			return ("" + v).toUpperCase();
		}
	};

	return function(v) {
		return Σ_call(type_funcs[type], v, [v]);
	};
}

function Σ_contains(needle, haystack, mangler) {
	return Σ_overload(haystack, {
		'object': function() {
			var found = false;
			Σ_each(haystack, function(k, v) {
				var temp = (typeof mangler == 'function') ? mangler(v) : v;
				if (temp == needle) {
					found = true;
					return false;
				}
			});

			return found;
		},
		'string': function() {
			var temp = (typeof mangler == 'function') ? mangler(haystack) : haystack;
			return (temp.indexOf(needle) > -1);
		},
		'default': function() { return false; }
	});
}

function SummITWrapper(type) {
	self = this;

	this["_Σ_class"] = require(type);
	this["_Σ_classType"] = type;
	Σ.extend(this, this["_Σ_class"]);

	function sanitize_args(args, context, func_name) {
		//Use Σ_walk for deep exception handling
		Σ_each(args, function(k, v) {
			Σ_overload(v, {
				'function': function() {
					this[k] = function temp() {
						try {
							return Σ_call(v, context, arguments);
						} catch(e) {
							self.emit("exception", [e]);
						}
					}
				}
			}, this);
		});

		return args;
	}

	Σ.each(this, function(k, v) {
		if (typeof v == 'function' && k != "_Σ_class") {
			this[k] = function() {
				try {
					var args = sanitize_args(arguments, this, k);
					return v.apply(this, args);
				} catch(e) {
					self.emit("exception", [e]);
				}
			}
		}
	});

	return self;
}
Σ_util.inherits(SummITWrapper, require("events").EventEmitter);

function Σ_require(type) {
	return new SummITWrapper(type);
}

function Σ_run(func) {
	if (Σ_cluster.isMaster) {
		var caller = _get_caller();
		var setup = {silent:false};
		if (caller && caller.filename) setup.exec = caller.filename;
		Σ_cluster.setupMaster(setup);

		var child_env = {callback:func};
		Σ_cluster.fork(child_env);

		Σ_cluster.on('disconnect', function(worker) {
			console.error('Child process died! Forking a new one...');
			Σ_cluster.fork(child_env);
		});
	} else {
		var d = require("domain").create();
		d.on('error', function(err) {
		    d.dispose();
			cluster.worker.disconnect();
			process.exit();
		});

		d.run(function() {
			if (typeof func == 'function') func();
		});
	}
};

//Special thanks to execjosh@StackOverflow for the following
function _get_stack() {
	// Save original Error.prepareStackTrace
	var tempPrepare = Error.prepareStackTrace;

	// Override with function that just returns `stack`
	Error.prepareStackTrace = function (_, stack) { return stack; }

	// Create a new `Error`, which automatically gets `stack`
	var err = new Error();
	// Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
	var stack = err.stack;

	// Restore original `Error.prepareStackTrace`
	Error.prepareStackTrace = tempPrepare;

	// Remove superfluous function call on stack
	stack.shift();

	return stack;
}

//Special thanks to execjosh@StackOverflow for the following
function _get_caller() {
	var stack = _get_stack();

	stack.shift();
	stack.shift();
	return stack[1].receiver;
}

Σ_extend(exports, {
	'call': Σ_call,
	'overload': Σ_overload,
	'empty': Σ_empty,
	'each': Σ_each,
	'extend': Σ_extend,
	'converter': Σ_converter,
	'contains': Σ_contains,
	'require': Σ_require,
	'run': Σ_run
});
