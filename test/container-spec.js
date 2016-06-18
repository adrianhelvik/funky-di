const assert = require('assert');
const Container = require('../container');

describe('Container', () => {

    let container;

    class NoDeps {}

    class Deps {
        constructor(foo) {
            this.foo = foo;
        }

        injectHello(hello) {
            this.hello = hello;
        }
    }

    beforeEach(done => {
        container = new Container();
        done();
    });

    describe('.putConstant', () => {
        it('can be inserted and take out', () => {
            container.putConstant('hello', 'world');
            assert.equal(container.getInjectable('hello'), 'world');
        });
    });

    describe('.putClass', () => {
        it('is instantiated every time it is injected', () => {
            container.putClass('myClass', NoDeps);

            const a = container.getInjectable('myClass');
            const b = container.getInjectable('myClass');

            assert.ok(a instanceof NoDeps);
            assert.ok(b instanceof NoDeps);
            assert.notEqual(a, b);
        });
    });

    describe('.putSingleton', () => {
        it('is only instantiated once', () => {
            container.putSingleton('myClass', NoDeps);

            const a = container.getInjectable('myClass');
            const b = container.getInjectable('myClass');

            assert.ok(a instanceof NoDeps);
            assert.ok(b instanceof NoDeps);
            assert.equal(a, b);
        });
    });

    describe('.getInjectable', () => {
        it('gets the injectable from the container', () => {
            container.putConstant('hello', 'world');
            assert.equal(container.getInjectable('hello'), 'world');
        });

        it('throws an error if the value was not found', () => {

            // Arrange...
            const a = new Container();
            const b = new Container();
            const c = new Container();
            b.extend(a);
            c.extend(b);

            // Act / assert...
            assert.throws(() => c.getInjectable('x'), Error);

        });
    });

    describe('.injectPrefixedMethods', () => {
        it('injects prefixed methods with inject as prefix by default', () => {
            container.putConstant('hello', 'world');
            const instance = new Deps;

            container.injectPrefixedMethods(Deps, instance);

            assert.equal(instance.hello, 'world');
        });

        it('can inject into methods with custom prefix', () => {
            const container = new Container({
                injectPrefix: 'myPrefix'
            });
            container.putConstant('something', 'sweet');

            class SomeClass {
                myPrefixSomething(something) {
                    this.something = something;
                }
            }

            const instance = new SomeClass;
            container.injectPrefixedMethods(SomeClass, instance);

            assert.equal(instance.something, 'sweet');
        });

        it('can be disabled', () => {
            const container = new Container({
                injectPrefix: false
            });
            container.putConstant('hello', 'world');

            const instance = new Deps;

            container.injectPrefixedMethods(Deps);

            assert.equal(instance.hello, undefined);
        });
    });

    describe('.injectInjectMethod', () => {
        it('injects into inject-method by default', () => {
            container.putConstant('bar', 'qux');
            container.putConstant('hello', 'world');

            class Lol {
                inject(foo = bar, hello) { // eslint-disable-line
                    this.foo = foo;
                    this.hello = hello;
                }
            }

            const lol = new Lol;

            container.injectInjectMethod(lol);

            assert.equal(lol.foo, 'qux');
            assert.equal(lol.hello, 'world');
        });

        it('can inject into specified method', () => {
            const container = new Container({
                injectMethod: 'myMethod'
            });
            container.putConstant('foo', 'bar');
            class Foobie {
                myMethod(foo) {
                    this.foo = foo;
                }
            }
            const foobie = new Foobie;

            container.injectInjectMethod(foobie);

            assert.equal(foobie.foo, 'bar');
        });

        it('can inject into constructor method', () => {
            const container = new Container({
                injectMethod: 'constructor'
            });

            container.putConstant('foo', 'bar');

            let timesCalled = 0;

            class Foobie {
                constructor(foo) {
                    this.foo = foo;
                    timesCalled++;
                }
            }

            const foobie = container.applyInject(Foobie);

            assert.equal(foobie.foo, 'bar');
            assert.equal(timesCalled, 1);
        });

        it('can be disabled', () => {
            const container = new Container({
                injectMethod: false
            });

            container.putConstant('foo', 'bar');

            class Foobie {
                inject(foo) {
                    this.foo = foo;
                }
            }

            const foobie = container.applyInject(Foobie);

            assert.strictEqual(foobie.foo, undefined);
        });
    });

    describe('.applyInject', () => {
        it('injects prefixed methods by default', () => {
            container.putConstant('hello', 'world');

            const instance = container.applyInject(Deps, ['bar']);

            assert.equal(instance.foo, 'bar');
            assert.equal(instance.hello, 'world');
        });
        it('injects the inject method by default', () => {
            container.putConstant('foo', 'bar');

            class SomeClass {
                inject(x = foo) { // eslint-disable-line
                    this.foo = x;
                }
            }

            const instance = container.applyInject(SomeClass);

            assert.equal(instance.foo, 'bar');
        });
    });

    describe('.inject', () => {
        it('injects a class with given arguments', () => {
            container.putConstant('hello', 'world');

            const instance = container.inject(Deps, 'cux');

            assert.equal(instance.foo, 'cux');
            assert.equal(instance.hello, 'world');
        });

        it('finds node module if parameter is a string', () => {

            class MyClass {
                inject(isNumber = 'is-number') {
                    this.isNumber = isNumber;
                }
            }

            const instance = container.inject(MyClass);

            assert.equal(instance.isNumber, require('is-number'));

        });

        it('throws error when trying to load node modules relative to their own directory', () => {

            class Relative {
                inject(thisShouldFail = './some-relative-path') {
                }
            }

            assert.throws(() => container.inject(Relative), /funky-di:/);
        });

        it('will inject a module with absolute path', () => {

            class Absolute {
                inject(thisShouldFail = '/some-mumbo-jumbo-absolute-path') {
                }
            }

            assert.throws(() => container.inject(Absolute), /Cannot find module/);
        });

    });

    describe('.containsInjectable', () => {
        it('returns whether the container or the containers it extends has access to the injectable', () => {

            // Arrange...
            const containerA = new Container();
            const containerB = new Container();
            const containerC = new Container();

            // Act..
            containerB.extend(containerA);
            containerC.extend(containerB);
            containerA.putConstant('a', 'A');
            containerC.putSingleton('c', NoDeps);

            // Assert...
            assert.ok(containerC.containsInjectable('a'));
            assert.ok(containerC.containsInjectable('c'));

        });
    });

    describe('.extend', () => {

        it('can extend other containers', () => {

            // Arrange...
            const containerA = new Container();
            const containerB = new Container();
            const containerC = new Container();

            // Act..
            containerB.extend(containerA);
            containerC.extend(containerB);
            containerA.putConstant('a', 'A');

            // Assert...
            assert.equal(containerC.getInjectable('a'), 'A');
        });

        it('gets values from last extended container first', () => {

            // Arrange...
            const a = new Container();
            const b = new Container();
            const c = new Container();

            // Act...
            a.putConstant('x', 1);
            b.putConstant('x', 2);
            c.extend(a);
            c.extend(b);

            // Assert...
            assert.equal(c.getInjectable('x'), 2);

        });

        it('throws an error if the extended container does not implement the correct methods', () => {
            assert.throws(() => container.extend({}), TypeError);
            assert.throws(() => container.extend({
                getInjectable: 'non-function',
                containsInjectable: 'non-function'
            }), TypeError);
            assert.doesNotThrow(() => container.extend({
                getInjectable() {},
                containsInjectable() {}
            }));
        });
    });

    it('has an auto incrementing id', () => {
        const a = (new Container()).id;
        const b = (new Container()).id;

        assert.ok(b === a + 1);
    });

    it('can specify only default injection', () => {
        const container = new Container({
            onlyDefaultParam: true
        });

        container.putConstant('hello', 'world');

        class ShouldFail {
            inject(hello) {
                this.hello = hello;
            }
        }

        class ShouldPass {
            inject(x = hello) { // eslint-disable-line
                this.hello= x;
            }
        }

        assert.throws(() => container.inject(ShouldFail));
        assert.doesNotThrow(() => container.inject(ShouldPass));
    });
});
