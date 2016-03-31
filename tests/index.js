"use nodent-es7";
"use strict";
/* Run all the scripts in ./tests compiled for ES7 and Promises */
var fs = require('fs');
var path = require('path');
var color = require('colors');
var nodent = require('../nodent')({
    log: function (msg) {}
});
var map = nodent.require('map');
global.sleep = async function sleep(t) {
    setTimeout(function () {
        try {
             async return undefined;
        } catch (ex) {
             async throw ex;
        }
    }, t);
};
global.breathe = async function breathe() {
    var t = Date.now();
    setImmediate(function () {
        try {
             async return Date.now() - t;
        } catch (ex) {
             async throw ex;
        }
    });
};
var providers = [];
providers.push({
    name: '(none)',
    p: null
});
providers.push({
    name: 'nodent.Thenable',
    p: nodent.Thenable
});
providers.push({
    name: 'nodent.Eager',
    p: nodent.EagerThenable()
});
if (global.Promise) {
    providers.push({
        name: 'native',
        p: global.Promise
    });
}
function makePromiseCompliant(module, promise, resolve) {
    var p = module[promise];
    p.resolve = module[resolve];
    return p;
}

var promiseImpls = providers.length;
try {
    var bluebird = require('bluebird');
    bluebird.config({
        warnings: false
    });
    providers.push({
        name: 'bluebird',
        p: bluebird
    });
} catch (ex) {}
try {
    providers.push({
        name: 'rsvp',
        p: require('rsvp').Promise
    });
} catch (ex) {}
try {
    providers.push({
        name: 'when',
        p: makePromiseCompliant(require('when'), 'promise', 'resolve')
    });
} catch (ex) {}
try {
    providers.push({
        name: 'promiscuous',
        p: require('promiscuous')
    });
} catch (ex) {}
var useQuick = false, quiet = false, useGenerators = false, useGenOnly = false, notES6 = false, syntaxTest = 0, forceStrict = "";
var idx;
try {
    eval("x=>0");
} catch (ex) {
    notES6 = true;
}
for (idx = 0; idx < process.argv.length; idx++) {
    var fqPath = path.resolve(process.argv[idx]);
    if (fqPath == __filename || fqPath == __dirname) 
        break;
}
idx += 1;
for (; idx < process.argv.length; idx++) {
    var arg = process.argv[idx];
    if (arg == '--syntaxonly') 
        syntaxTest = 1;
     else if (arg == '--syntax') {
        syntaxTest = 2;
    } else if (arg == '--generators' || arg == '--genonly') {
        try {
            useGenOnly = arg == '--genonly';
            eval("var temp = new Promise(function(){}) ; function* x(){ return }");
            useGenerators = true;
            if (useGenOnly) 
                providers.splice(1, 1);
        } catch (ex) {
            console.warn("OOPS! Installed platform does not support Promises or Generators - skipping some tests");
            if (useGenOnly) 
                process.exit(-1);
        }
    } else if (arg == '--output' || arg == '--es7' || arg == '--save') {
        console.log('Option '.grey+arg+' is deprecated and will be ignored.'.grey)
    } else if (arg == '--quiet') {
        quiet = true;
    } else if (arg == '--quick') {
        useQuick = true;
    } else if (arg == '--forceStrict') {
        forceStrict = "'use strict';\n";
    } else {
        break;
    }
}
function pad(s, n) {
    return ("                                " + s).substr(-(n || 32));
}

if (syntaxTest) {
    require('./test-syntax').testFiles(process.argv.length > idx ? process.argv.slice(idx) : [__dirname + "/.."], true);
    if (syntaxTest == 1) 
        return;
}
var files = (process.argv.length > idx ? process.argv.slice(idx) : fs.readdirSync('./tests/semantics').map(function (fn) {
    return './tests/semantics/' + fn;
})).filter(function (n) {
    return n.match(/.*\.js$/);
});
if (notES6) {
    files = files.filter(function (n) {
        if (n.match(/es6-.*/)) {
            console.log(n.split("/").pop() + " (skipped - ES6 platform not installed)".yellow);
            return false;
        }
        return true;
    });
}
var tTotalCompilerTime = 0;
var test = [];
var i = 0;
function time(hr) {
    var t = process.hrtime(hr);
    return t[0] * 1000 + t[1] / 1e6;
}

var types = [];
files.forEach(function (n) {
    test[i] = {
        name: n.split("/").pop().replace(/\.js$/, ""),
        fn: []
    };
    process.stdout.write('\r- Compiling ' + test[i].name + '                         \r');
    var code = fs.readFileSync(n).toString();
    for (var type = 0;type < (useGenerators ? 12 : 8); type++) {
        var opts = {}; //  es7:true } ;
        if (!(type & 1)) 
            opts.lazyThenables = true;
        if (type & 2) 
            opts.wrapAwait = true;
        if (type & 4) 
            opts.promises = true;
        if (type & 8) 
            opts.generators = true;
        if (!(type & (4|8)))
            opts.es7 = true;
        types[type] = Object.keys(opts).toString() ;
        var tCompiler = process.hrtime();
        var pr = nodent.compile(forceStrict + code, n, opts).code;
        tTotalCompilerTime += time(tCompiler);
        test[i].fn[type] = new Function("module", "require", "Promise", "__unused", "nodent", "DoNotTest", pr);
    }
    i += 1;
});
console.log("Total compile time:", ((tTotalCompilerTime | 0) + "ms").yellow);
if (useQuick) 
    console.log('Timings with', '--quick'.yellow, 'are subject to significant GC jitter. Remove', '--quick'.yellow, 'for accurate timing comparison');
if (promiseImpls == providers.length) 
    console.log('To test against some popular Promise implementations,', 'cd tests && npm i && cd ..'.yellow);
function DoNotTest() {
    throw DoNotTest;
}

async function runTest(test, provider, type) {
    if (provider.p && !(type & (4 | 8))) 
        return {
        result: DoNotTest
    };
    await breathe();
    var m = {}, result;
    test.fn[type](m, require, provider.p || DoNotTest, undefined, nodent, DoNotTest);
    var t = process.hrtime();
    try {
        result = await m.exports();
        if (result != true) 
            throw result;
    } catch (ex) {
        result = ex;
    }
    return {
        t: time(t),
        result: result
    };
}

try {
    var result, byType = {}, byProvider = {}, byTest = {}, table = [];
    for (var i = 0;i < test.length; i++) {
        var benchmark = null;
        for (var j = 0;j < providers.length; j++) {
            process.stdout.write('\r- Test: ' + test[i].name + ' using ' + providers[j].name.yellow + '                           \r');
            for (var type = useGenOnly ? 8 : 0;type < (useGenerators ? 12 : 8); type++) {
                var ticks = [];
                table[type] = table[type] || [];
                table[type][j] = table[type][j] || [];
                // Warm up V8
                result = await runTest(test[i], providers[j], type);
                if (result.result !== true) {
                    if (result.result !== DoNotTest) {
                        console.log(test[i].name, '\u2717'.red, types[type].red, providers[j].name.red, result.result.toString().red);
                        type = 32767;
                        j = providers.length;
                    }
                    continue;
                }
                var t = 0;
                var cond = useQuick ? function () {
                    return ticks.length < 2;
                } : function () {
                    return t < 100 || ticks.length < 20;
                };
                while (cond()) {
                    result = await runTest(test[i], providers[j], type);
                    ticks.push(result.t);
                    t += result.t;
                }
                ticks = ticks.sort();
                var median = ticks[ticks.length / 2 | 0];
                var metric = median;
                if (!benchmark) 
                    benchmark = metric;
                metric = metric / benchmark * 100;
                result = {
                    value: result.result,
                    metric: metric,
                    provider: providers[j].name,
                    type: types[type],
                    test: test[i].name
                };
                table[type][j].push(metric);
                byType[types[type]] = byType[types[type]] || [];
                byType[types[type]].push(result);
                byProvider[providers[j].name] = byProvider[providers[j].name] || [];
                byProvider[providers[j].name].push(result);
            }
        }
    }
    function extract(a, field) {
        if (!Array.isArray(a)) {
            return NaN;
        }
        return a.map(function (n) {
            return n[field];
        });
    }
    
    function avg(by) {
        if (!Array.isArray(by)) 
            return NaN;
        return by.filter(function (n) {
            return typeof n === 'number';
        }).reduce(function (a, b) {
            return a + b;
        }, 0) / by.length;
    }
    
    function traffic(n) {
        if (isNaN(n)) 
            return pad('-', 16).blue;
        if (n < 120) 
            return pad('' + (n | 0), 16).green;
        if (n < 200) 
            return pad('' + (n | 0), 16).white;
        if (n < 300) 
            return pad('' + (n | 0), 16).yellow;
        return pad('' + (n | 0), 16).red;
    }
    
    debugger ;
    var n;
    var fidx = Object.keys(table)[0] ;
    n = pad('') + pad('', 16);
    for (i = 0; i < table[fidx].length; i++) {
        n += pad(providers[i].name, 16);
    }
    console.log(n);
    n = pad('Compiler flags') + pad('Mean', 16);
    for (i = 0; i < table[fidx].length; i++) {
        n += traffic(avg(extract(byProvider[providers[i].name], 'metric')));
    }
    console.log(n.underline);
    for (i = 0; i < table.length; i++) {
        var typed = table[i];
        if (typed) {
            n = pad(types[i]) + traffic(avg(extract(byType[types[i]], 'metric')));
            for (j = 0; j < typed.length; j++) {
                n += traffic(avg(typed[j]));
            }
            console.log(n);
        }
    }
    console.log('');
} catch (ex) {
    console.error(ex.stack || ex);
}

