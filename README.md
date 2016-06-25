Funky DI - Dependency injection for ES6 classes
===============================================

This package is focused on dependency injection for
ES6 classes in node. If you need dependency injection for
functions as well, you might want to check out
Codependent - another project I have made.
But I would recommend using Funky DI instead.
It has more tests and a more coherent API.

This package has very few dependencies, and at the time
of writing it has 42 unit tests. It utilizes funky-di-util
which has 33 unit tests. So if anything is unclear about
how the package works, clone the repo and run
npm test.

Installation
------------

`npm install --save funky-di`

Important note
--------------

This package should only be used with node, not
in the browser, as the injector relies upon
parsing the toString of functions for injection.

This will not work if the code is minified.

Immutable
---------

The containers are immutable and you can never
overwrite a value in a given container. You
can however create a new container and extend
it with another. This new container can have a
value with the same name as the previous value.

The impact this has on usage is that you should
create a new container instance if you need to
replace values, this new container can then
extend the base container, which holds the more
persistent data.

### Example

```javascript
const Container = require('funky-di');

const mainContainer = new Container();
mainContainer.putConstant('apiUrl', 'https://path-to-api.com');

const server = http.createServer((request, response) {
    const transientContainer = new Container();
    transientContainer.extend(mainContainer);

    transientContainer.putConstant('request', request);
    transientContainer.putConstant('response', response);

    transientContainer.injectFunction(requestHandler);
});

function requestHandler(api = apiUrl, req = request, res = response) {
    // api is resolved to apiUrl from mainContainer
    // req is resolved to request from transientContainer
    // res is resolved to response from transientContainer
}

server.listen(1999);
```

Installation
------------

`npm install funky-di --save`

Creating a container
--------------------

```javascript
const Container = require('funky-di');
const myContainer = new Container(‹options object›);
```

Possible options:
* `onlyDefaultParam`: {boolean} Disallow angular style DI
* `name`: {string} currently not in use - will be used for error checking. Defaults to 'unnamed-' + incrementing id
* `injectPrefix`: {string|false} Prefix for methods that should utilize type 1 DI, or disable with false (see section "Ways to inject")
* `injectMethod`: {string|false} Name of method that utilizes type 2 DI, or disable with false (see section "Ways to inject")

Injecting a class
-----------------

### container.inject(‹class›, ...‹args›)

container.inject is the same as calling `new MyClass(arg1, arg2, arg3)`,
except it is also dependency injected.

```javascript
const myInstance = myContainer.inject(MyClass, arg1, arg2, arg3);
```

### container.applyInject(‹class› ‹array of args›)

container.applyInject uses Reflect.construct behind the scenes,
and resembles Function.prototype.apply, except it is newed up.
The code below is equivalent to the code above.

```javascript
const anotherInstance = myContainer.applyInject(MyClass, [arg1, arg2, arg3]);
```

Adding values to the container
------------------------------

```javascript
myContainer.putConstant('hello', 'world');
myContainer.getInjectable('hello');
// => 'world'

myContainer.putClass('MyClass', MyClass);
myContainer.getInjectable('MyClass');
// => new instance of MyClass

myContainer.putSingleton('MySingleton', MySingleton);
myContainer.getInjectable('MySingleton');
// => stored instance of MySingleton
```

Ways to inject
--------------

### Type 1: Inject into prefixed method injection depending on method name

**Enabled by default**

* Default: "inject"
* How to change prefix:
    * Set `options.injectPrefix` to a string to change or false to disable
* Casing of first letter is ignored.
    * Lower case first letter is first attempted
    * then upper case first letter is attempted

#### Example:
```javascript
class MyClass {
    injectSomething(x) {
        // 'something' is looked up
    }
}
```

### Type 2: Injection through special method

**Enabled by default**

You can use angular style injection if enabled (see `OtherDependency` below),
or use default argument values to inject a value (see `Dependecy` below).
To inject node modules supply a string as the argument. Unfortunately
relative paths are not supported, and will throw an error.
A solution is to use `path.resolve(__dirname, 'relative/path-to-file')`

For a more classical DI feel you can change `options.injectMethod` to
`constructor`. With Any other methods, they will load after the class
has been constructed, but with `constructor` as the inject method,
you will have access to all of your dependencies in the constructor
as well.

* Default: "inject"
* How to change:
    * Set `options.injectMethod` to string to change or false to disable

#### Example:
```javascript
const Container = require('funky-di');
const container = new Container({
    onlyDefaultParam: false // defaults to true
});

MyClass {
    inject(a = Dependency, OtherDependency, lodash = 'lodash') {
        // 'Dependency' is looked up in container
        // 'OtherDependency' is looked up in container (for this to work onlyDefaultParam must be false)
        // 'lodash' is required and injected
    }
}
```

#### Important note

If you use any other `injectMethod` than constructor,
dependencies will be loaded after the constructor has been
called. If you choose to keep the default `inject` as the
injection method, you should consider bootstrapping your
class in this method or outside the method. If you don't
mind constructing the class asynchronously, you can simply
call `process.nextTick(() => { /* bootstrap class */ })`
in the constructor.

#### Angular style or default parameter injection

Both are supported when injecting through with Type 2
injection (and neither with type 1). I prefer default
parameter injection.

* It is easy to see that the function is injected
* it allows you to inject multiple instances of a class

I find the angular style useful in some scenarios, as it's
more succinct and I like to to be able to choose.

For this reason I added the possibility to set
`option.onlyDefaultParam` if you wish to explicitly
angular style DI.

### container.injectFunction

Inject dependencies into a function.

```javascript
container.injectFunction([‹thisArg›, ]‹function›);
```

### container.putProvider

This function is called every time you inject the value.

```javascript
container.putProvider(‹name›, (‹injectables...›) => {
    // return injectable
});
```

### container.injectFolder

Load all js-files within a folder and register them
in the container. (more info under usage and options)

```javascript
app.injectFolder(‹folderName›[, ‹options›]);

```

#### Usage and options

If neither `options.injectionType` or `options.provider`
is set, the default injection method will be to rely
on the file names to determine the injection type
for each file. It follows this pattern: `‹injectedName›.‹injectionType›.js`.
InjectionType can be `class`, `constant`, `singleton`
and `provider`.

If `options.injectionType` or `options.provider` is set,
the pattern will be `‹injectedName›.js`

By default **The names are lowercased and then camelcased.**
so that `my-value.constant.js` and `myValue.constant.js` both
result in the exported value (`module.exports`) being registered
under the name `myValue`. If `options.injectionType` is set to class,
you can set `options.useClassName` to true to rely on the `name`
property of classes instead of the file names.

```javascript
const options = {
    injectionType: ‹'class'|'provider'|'singleton'›,
    provider(value) {
        return ...;
    }
}
```

Testing
-------

### Unit testing

* `npm i -g mocha`
* `mocha` or `npm test`

### Memory leak test

I made a simple memory leak test. To run it use `npm run leak-check`.
I did this to ensure that a functional approach (with transient containers)
would not cause any memory leaks.

The test has run for more than an hour without any leaks being detected.

Pull requests
-------------

* Create a new branch
* Write tests
* Implement functionality
* Send pull request

Licence: ISC
============

Copyright (c) 2016(s), Adrian Helvik

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE
INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
