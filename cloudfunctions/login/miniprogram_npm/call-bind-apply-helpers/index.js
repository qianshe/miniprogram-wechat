module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1773508877430, function(require, module, exports) {


var bind = require('function-bind');
var $TypeError = require('es-errors/type');

var $call = require('./functionCall');
var $actualApply = require('./actualApply');

/** @type {(args: [Function, thisArg?: unknown, ...args: unknown[]]) => Function} TODO FIXME, find a way to use import('.') */
module.exports = function callBindBasic(args) {
	if (args.length < 1 || typeof args[0] !== 'function') {
		throw new $TypeError('a function is required');
	}
	return $actualApply(bind, $call, args);
};

}, function(modId) {var map = {"./functionCall":1773508877431,"./actualApply":1773508877432}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1773508877431, function(require, module, exports) {


/** @type {import('./functionCall')} */
module.exports = Function.prototype.call;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1773508877432, function(require, module, exports) {


var bind = require('function-bind');

var $apply = require('./functionApply');
var $call = require('./functionCall');
var $reflectApply = require('./reflectApply');

/** @type {import('./actualApply')} */
module.exports = $reflectApply || bind.call($call, $apply);

}, function(modId) { var map = {"./functionApply":1773508877433,"./functionCall":1773508877431,"./reflectApply":1773508877434}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1773508877433, function(require, module, exports) {


/** @type {import('./functionApply')} */
module.exports = Function.prototype.apply;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1773508877434, function(require, module, exports) {


/** @type {import('./reflectApply')} */
module.exports = typeof Reflect !== 'undefined' && Reflect && Reflect.apply;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1773508877430);
})()
//miniprogram-npm-outsideDeps=["function-bind","es-errors/type"]
//# sourceMappingURL=index.js.map