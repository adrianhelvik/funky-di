'use strict';

const callsites = require('callsites');
const path = require('path');

const {
    deleteAll,
    throwIfDefined,
    removePrefix,
    lowerCaseFirst,
    getMethodsWithPrefix,
    getAllMethods,
    getDefaultParams,
    implementOrThrow,
    isDefined
} = require('./util');

var nextId = (() => {
    let currentId = 0;
    return () => {
        return currentId++;
    };
})();

class Container {
    constructor(options = { injectPrefix: 'inject', name: 'unnamed', injectMethod: 'inject', onlyDefaultParam: false }) {

        if (typeof options !== 'object' || ! options) {
            throw TypeError('Container options must be an object! Got: ' + options);
        }

        this.id = nextId();

        options.name = options.name || 'unnamed ' + this.id;

        // If some options are changed, update
        // undefined options
        if (options.injectPrefix === undefined) {
            options.injectPrefix = 'inject';
        }
        if (options.name === undefined) {
            options.name = 'unnamed';
        }
        if (options.injectMethod === undefined) {
            options.name = 'inject';
        }
        if (options.onlyDefaultParam === undefined) {
            options.onlyDefaultParam = false;
        }
        if (options.injectMethod === undefined) {
            options.injectMethod = 'inject';
        }

        this.options = options;

        this.class = {};
        this.constant = {};
        this.singleton = {};

        this.singletonInstances = {};

        this.extendedContainers = [];

        if (options.injectMethod === 'constructor') {
            this.options.injectMethod = false;
            this.injectConstructor = true;
        }
    }

    _verifyNotDefined(name) {
        const puttable = getMethodsWithPrefix(Container, 'put')
            .map(method => removePrefix(method, 'put'))
            .map(lowerCaseFirst);

        for (const puttableType of puttable) {
            throwIfDefined(
                this[puttableType][name],
                `Container: Can not override ${puttableType} "${name}"`
            );
        }
    }

    putConstant(name, constant) {
        this._verifyNotDefined(name);

        this.constant[name] = constant;
    }

    putClass(name, clazz) {
        this._verifyNotDefined(name);

        this.class[name] = clazz;
    }

    putSingleton(name, clazz) {
        this._verifyNotDefined(name);

        this.singleton[name] = clazz;
    }

    getInjectable(name) {
        // Node module injections are wrapped with ' or "
        if (name.startsWith('\'') && name.endsWith('\'') || name.startsWith('"') && name.endsWith('"')) {
            name = name.substring(1, name.length - 1);

            if (name.startsWith('.')) {
                throw Error('funky-di: Cannot resolve node modules from relative paths.');
            }

            return require(name);
        }
        if (isDefined(this.constant[name])) {
            return this.constant[name];
        }
        if (this.class[name]) {
            return this.inject(this.class[name]);
        }
        if (this.singletonInstances[name]) {
            return this.singletonInstances[name];
        }
        if (this.singleton[name]) {
            const instance = this.inject(this.singleton[name], []);
            this.singletonInstances[name] = instance;
            return this.getInjectable(name);
        }

        for (let i = this.extendedContainers.length - 1; i >= 0; i--) {
            if (this.extendedContainers[i].containsInjectable(name)) {
                return this.extendedContainers[i].getInjectable(name);
            }
        }

        throw Error(name + ' is not in container');
    }

    containsInjectable(name) {
        return isDefined(this.constant[name]) ||
            this.class[name] ||
            this.singletonInstances[name] ||
            this.singleton[name] ||
            this.extendedContainers.some(c => c.containsInjectable(name));
    }

    applyInject(clazz, args = []) {

        if (this.injectConstructor) {
            if (args.length) {
                throw Error('Cannot specify args when injecting the constructor');
            }

            const params = getDefaultParams(clazz.prototype.constructor);
            args = this._getInjectableFromParameters(params);
        }

        const instance = Reflect.construct(clazz, args);

        this.injectPrefixedMethods(clazz, instance);
        this.injectInjectMethod(instance);

        return instance;
    }

    inject(clazz, ...args) {
        console.log('...', callsites()[1].getFileName());
        return this.applyInject(clazz, args);
    }

    injectPrefixedMethods(clazz, instance) {
        if (typeof this.options.injectPrefix !== 'string') {
            if (this.options.injectPrefix !== false) {
                console.log(this.options);
                throw TypeError('options.injectPrefix must be string or false');
            }
            return instance;
        }

        const prefixedMethods = getMethodsWithPrefix(clazz, this.options.injectPrefix)
            .filter(method => method !== this.options.injectPrefix);

        const attrs = prefixedMethods
            .map(method => removePrefix(method, this.options.injectPrefix))
            .map(lowerCaseFirst);

        for (let i = 0; i < prefixedMethods.length; i++) {
            instance[prefixedMethods[i]](this.getInjectable(attrs[i]));
        }

        return instance;
    }

    _getInjectableFromParameters(params) {
        const injectedArgs = [];

        for (const key of Object.keys(params)) {
            if (params[key] !== null) {
                injectedArgs.push(this.getInjectable(params[key]));
            } else if (! this.options.onlyDefaultParam) {
                injectedArgs.push(this.getInjectable(key));
            } else {
                throw TypeError(
`Angular style injection disabled!. Use default parameter injection instead.
Replace:

    class MyClass {
        inject(MyInjectable) {
            // ...
        }
    }

with:

    class MyClass {
        inject(x = MyInjectable) {
            // ...
        }
    }

To disable, set options.onlyDefaultParam to false/undefined.`);
            }
        }

        return injectedArgs;
    }

    injectInjectMethod(instance) {

        if (typeof instance[this.options.injectMethod] !== 'function') {
            return;
        }

        const params = getDefaultParams(instance[this.options.injectMethod]);
        const injectedArgs = this._getInjectableFromParameters(params);

        instance[this.options.injectMethod].apply(instance, injectedArgs);
    }

    extend(other) {
        implementOrThrow(other, ['getInjectable', 'containsInjectable']);

        this.extendedContainers.push(other);
    }
}

module.exports = Container;
