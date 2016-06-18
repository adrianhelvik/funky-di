Funky DI - Dependency injection for classes
===========================================

This package is focused on dependency injection for
ES6 classes. If you need dependency injection for
functions as well, you might want to check out
Codependent - another project I have made.

This package has zero dependencies and at the time
of writing it has 55 unit tests, whereas 24 are for the
container itself and the rest are for parameter parsing.

Creating a container
--------------------

```javascript
const Container = require('funky-di');
const myContainer = new Container(‹options object›);
```

Possible options:
* `onlyDefaultParam`: {boolean} Disallow angular style DI
* `name`: {string} currently not in use
* `injectPrefix`: {string|false} Prefix for methods that should utilize type 1 DI, or disable with false (see section "Ways to inject")
* `injectMethod`: {string|false} Name of method that utilizes type 2 DI, or disable with false (see section "Ways to inject")

Injecting a class
-----------------

### Container.inject(‹class›, ...‹args›)

Container.inject is the same as calling `new MyClass(arg1, arg2, arg3)`,
except it is also dependency injected.

```javascript
const myInstance = myContainer.inject(MyClass, arg1, arg2, arg3);
```

### Container.applyInject(‹class› ‹array of args›)

Container.applyInject uses Reflect.construct behind the scenes,
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

#### Example:
```javascript
injectSomething(x) {
    // 'something' is looked up
}
```

### Type 2: Injection through special method

**Enabled by default**

You can use angular style injection (see `OtherDependency` below),
or use default argument values to inject a value (see `Dependecy` below).
To inject node modules supply a string as the argument. Unfortunately
relative paths are not supported, and will throw an error.
A solution is to use `path.resolve(__dirname, 'relative/path-to-file')`

* Default: "inject"
* How to change:
    * Set `options.injectMethod` to string to change or false to disable

#### Example:
```javascript
MyClass {
    inject(a = Dependency, OtherDependency, lodash = 'lodash') {
        // 'Dependency' is looked up in container
        // 'OtherDependency' is looked up in container
        // 'lodash' is required and injected
    }
}
```

#### Angular style or default parameter injection

Both are supported when injecting through with Type 2
injection (and neither with type 1). I prefer the way
default parameter injection looks, and it allows you
to inject multiple instances of a class. I find
the angular style useful in some scenarios, as it's
more succinct, but it makes it harder to see whether
the class / method is actually dependency injected.

For this reason I added the possibility to set
`option.onlyDefaultParam` if you wish to disallow
angular style DI.

Testing
-------

* `npm i -g mocha`
* `mocha` or `npm test`

Pull requests
-------------

* Create a new branch
* Write tests
* Send pull request
# funky-di
