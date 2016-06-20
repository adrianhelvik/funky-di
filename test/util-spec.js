const util = require('../util');
const assert = require('assert');

describe('util', () => {
    describe('.deleteAll', () => {
        it('deletes all specified props from an object', () => {
            const obj = { a: 1, b: 2, c: 3 };

            util.deleteAll(obj, ['a', 'c']);

            assert.equal('a' in obj, false);
            assert.equal('c' in obj, false);
            assert.equal('b' in obj, true);
        });
    });

    describe('.getAllMethods', () => {
        it('gets all method names from a class', () => {
            class MyClass {
                a/*hello*/() {}
                b//world
                () {}
            }

            assert.deepEqual(util.getAllMethods(MyClass), ['a', 'b']);
        });
    });

    describe('.getDefaultParams', () => {
        it('parses default params', () => {
            function fn(a = b, c = d + e, f = "g, h\" = i") {} // eslint-disable-line

            const params = util.getDefaultParams(fn);

            assert.equal(params.a, 'b');
            assert.equal(params.c, 'd + e');
            assert.equal(params.f, '"g, h\\" = i"');
        });

        it('doesn\'t touch params in an object. Eg: fn({ a = 10, b = 20 })', () => {
            function fn({ a = 10, b = 20 } = {}) {} // eslint-disable-line

            const params = util.getDefaultParams(fn);

            assert.deepEqual(params['{ a = 10, b = 20 }'], '{}');
        });

        it('is stored as a key with an undefined value if no default param was given', () => {
            function fn(a, b) {}

            const params = util.getDefaultParams(fn);

            assert.deepEqual(params, { 'a': null, 'b': null });
        });
    });

    describe('.splitRawParams', () => {
        it('splits raw params', () => {
            function fn(a = b, c = d + e, f = "g, h\" = 'i'") {} // eslint-disable-line

            const rawParams = util.getRawParameters(fn);
            const params = util.splitRawParams(rawParams);

            assert.deepEqual(params, ['a = b', 'c = d + e', 'f = "g, h\\" = \'i\'"']);
        });

        it('doesn\'t touch params in an object. Eg: fn({ a, b })', () => {
            function fn({ a = 10, b = 20 } = {}) {} // eslint-disable-line

            const rawParams = util.getRawParameters(fn);
            const params = util.splitRawParams(rawParams);

            assert.deepEqual(params, ['{ a = 10, b = 20 } = {}']);
        });

        it('doesn\'t touch params in an array. Eg: fn([ a, b ])', () => {
            function fn([ a = 10, b = 20 ]) {} // eslint-disable-line

            const rawParams = util.getRawParameters(fn);
            const params = util.splitRawParams(rawParams);

            assert.deepEqual(params, ['[ a = 10, b = 20 ]']);
        });
    });

    describe('.getRawParameters', () => {

        it('works for regular functions', () => {
            function fn(a = 10, b) { }
            const params = util.getRawParameters(fn);
            assert.equal(params, 'a = 10, b');
        });

        it('works for unnamed functions', () => {
            const params = util.getRawParameters(function(a=10,b){});
            assert.equal(params, 'a=10,b');
        });

        it('works for class method', () => {
            class MyClass {
                fn (a = (10), b) {
                }
            }

            const instance = new MyClass;

            const paramsA = util.getRawParameters(MyClass.prototype.fn);
            const paramsB = util.getRawParameters(MyClass.prototype.fn);

            assert.equal(paramsA, paramsB);
            assert.equal(paramsA, 'a = (10), b');
        });

        it('works for arrow functions w/o parens and with curlies', () => {
            const fn=param=>{}; // eslint-disable-line
            const params = util.getRawParameters(fn);
            assert.equal(params, 'param');
        });

        it('works for arrow functions w/o parens and w/o curlies', () => {
            const fn=param=>param; // eslint-disable-line
            const params = util.getRawParameters(fn);
            assert.equal(params, 'param');
        });

        it('works for arrow functions with parens and with curlies', () => {
            const fn=(param)=>{param}; // eslint-disable-line
            const params = util.getRawParameters(fn);
            assert.equal(params, 'param');
        });

        it('works for arrow functions with parens and w/o curlies', () => {
            const fn=(param, b=(x+2))=>param; // eslint-disable-line
            const params = util.getRawParameters(fn);
            assert.equal(params, 'param, b=(x+2)');
        });

        it('works for arrow functions with parens no arguments', () => {
            const fn=()=>{}; // eslint-disable-line
            const params = util.getRawParameters(fn);
            assert.equal(params, '');
        });

        it('works for terse methods with params', () => {
            const obj = {
                myFunc(a = 1, c = (2 + 3)) {
                }
            };
            const params = util.getRawParameters(obj.myFunc);
            assert.equal(params, 'a = 1, c = (2 + 3)');
        });
        it('works for terse methods w/o params', () => {
            const obj = {
                myFunc() {
                }
            };
            const params = util.getRawParameters(obj.myFunc);
            assert.equal(params, '');
        });
    });

    describe('.getMethodsWithPrefix', () => {
        it('gets the method names that has the given prefix from a class', () => {
            class MyClass {
                preHello() {}
                lol() {}
            }

            assert.deepEqual(util.getMethodsWithPrefix(MyClass, 'pre'), ['preHello']);
        });
    });

    describe('.lowerCaseFirst', () => {
        it('converts the first letter of a string to lowercase', () => {
            assert.equal(util.lowerCaseFirst('Hello'), 'hello');
            assert.equal(util.lowerCaseFirst('HELLO'), 'hELLO');
            assert.equal(util.lowerCaseFirst('hello'), 'hello');
        });
    });

    describe('.delimiterParser', () => {
        it('keeps track of parens', () => {
            let finalBalance;
            let greatest = 0;

            util.delimiterParser('( )', (balance, string, i) => {
                if (balance.paren > greatest) {
                    greatest = balance.paren;
                }
            }, balance => {
                finalBalance = balance;
            });

            assert.equal(finalBalance.paren, 0);
            assert.equal(greatest, 1);
        });

        it('keeps track of curlies', () => {
            let finalBalance;
            let greatest = 0;

            util.delimiterParser('{ }', (balance) => {
                if (balance.curly > greatest) {
                    greatest = balance.curly;
                }
            }, balance => {
                finalBalance = balance;
            });

            assert.equal(finalBalance.curly, 0);
            assert.equal(greatest, 1);
        });

        it('keeps track of brackets', () => {
            let finalBalance;
            let greatest = 0;

            util.delimiterParser('[ ]', (balance) => {
                if (balance.brack > greatest) {
                    greatest = balance.brack;
                }
            }, balance => {
                finalBalance = balance;
            });

            assert.equal(finalBalance.brack, 0);
            assert.equal(greatest, 1);
        });

        it('ignores multi line comments', () => {
            const str = 'a/*b//*/c/*  */';
            const expected = 'ac';
            let res = '';

            util.delimiterParser(str, (balance, str, i) => {
                res += str[i];
            });

            assert.equal(res, expected);
        });

        it('ignores single line comments', () => {
            const str = `a///*b
            c`;
            const expected = 'ac';
            let res = '';

            util.delimiterParser(str, (balance, str, i) => {
                res += str[i].trim();
            });

            assert.equal(res, expected);
        });
    });

    describe('.removePrefix', () => {
        it('removes a prefix from a string', () => {
            assert.equal(util.removePrefix('Hello world', 'Hello '), 'world');
        });
    });

    describe('.throwIfDefined', () => {
        it('throws if the value is not undefined', () => {
            assert.throws(() => util.throwIfDefined('something'));
            assert.throws(() => util.throwIfDefined(null));
            assert.throws(() => util.throwIfDefined(false));
            assert.throws(() => util.throwIfDefined(0));
        });
        it('does not throw if the value is undefined', () => {
            assert.doesNotThrow(() => util.throwIfDefined());
            assert.doesNotThrow(() => util.throwIfDefined(undefined));
        });
    });

    describe('.hasMethods', () => {
        it('checks if an object has a set of methods', () => {
            const obj = {
                hello() {
                },
                world() {
                }
            };

            assert.ok(util.hasMethods(obj, ['hello', 'world']));
            assert.ok(! util.hasMethods(obj, ['hello', 'world', 'foo']));
            assert.ok(! util.hasMethods(obj, ['bar']));
        });
    });

    describe('.implementOrThrow', () => {
        it('throws a TypeError if the object doesn\'t have the methods listed', () => {
            const obj = {
                hello() {
                },
                world() {
                }
            };

            assert.doesNotThrow(() => util.implementOrThrow(obj, ['hello', 'world']));
            assert.throws(() => util.implementOrThrow(obj, ['hello', 'world', 'baz']));
        });
    });

    describe('.isDefined', () => {
        it('returns whether the values is !== undefined', () => {
            assert.ok(util.isDefined(''));
            assert.ok(util.isDefined(0));
            assert.ok(util.isDefined(false));
            assert.ok(util.isDefined(null));

            assert.equal(util.isDefined(), false);
            assert.equal(util.isDefined(undefined), false);
        });
    });

    describe('.removeSuffix', () => {
        it('removes a suffix from a string', () => {
            assert.equal(util.removeSuffix('hello world', ' world'), 'hello');
        });
    });
    describe('.upperCaseFirst', () => {
        it('uppercases the first letter of a word', () => {
            assert.equal(util.upperCaseFirst('hello world'), 'Hello world');
            assert.equal(util.upperCaseFirst('hELLO WORLD'), 'HELLO WORLD');
            assert.equal(util.upperCaseFirst('Hello world'), 'Hello world');
        });
    });
});
