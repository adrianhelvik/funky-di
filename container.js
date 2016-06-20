'use strict';

const path = require('path');
const fs = require('fs');
const camelcase = require('camelcase');
const callsites = require('callsites');

const {
    deleteAll,
    throwIfDefined,
    removePrefix,
    lowerCaseFirst,
    getMethodsWithPrefix,
    getAllMethods,
    getDefaultParams,
    implementOrThrow,
    isDefined,
    removeSuffix,
    upperCaseFirst,
} = require('./util');

var lastId = 0;

class Container {
    constructor(options = { injectPrefix: 'inject', name: 'unnamed', injectMethod: 'inject', onlyDefaultParam: true }) {

        if (typeof options !== 'object' || ! options) {
            throw TypeError('Container options must be an object! Got: ' + options);
        }

        this.id = lastId++;

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
            options.onlyDefaultParam = true;
        }
        if (options.injectMethod === undefined) {
            options.injectMethod = 'inject';
        }

        this.options = options;

        this.class = {};
        this.constant = {};
        this.singleton = {};
        this.provider = {};

        this.singletonInstances = {};

        this.extendedContainers = [];

        if (options.injectMethod === 'constructor') {
            this.options.injectMethod = false;
            this.injectConstructor = true;
        }
    }

    _verifyName(name) {
        if (typeof name !== 'string' || ! /^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(name)) {
            throw Error('Container: Invalid name');
        }

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

    _verifyIsFunction(name, value) {
        if (typeof value !== 'function') {
            throw TypeError('Error when registering "' + name + '" A function is required. Got: ' + value); // TODO: Refine check to test if something is a class
        }
    }

    putConstant(name, constant) {
        this._verifyName(name);

        this.constant[name] = constant;
    }

    putClass(name, clazz) {
        this._verifyName(name);
        this._verifyIsFunction(name, clazz);

        this.class[name] = clazz;
    }

    putSingleton(name, clazz) {
        this._verifyName(name);
        this._verifyIsFunction(name, clazz);

        this.singleton[name] = clazz;
    }

    putProvider(name, providerFn) {
        this._verifyName(name);
        this._verifyIsFunction(name, providerFn);

        this.provider[name] = providerFn;
    }

    getInjectable(name) {
        // Node module injections are wrapped with ' or "
        if (name.startsWith('\'') && name.endsWith('\'') || name.startsWith('"') && name.endsWith('"')) {
            name = name.substring(1, name.length - 1);

            // Relative injections are not supported
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
        if (this.provider[name]) {
            return this.injectFunction(this.provider[name]);
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

        return this.injectFunction(instance, instance[this.options.injectMethod]);
    }

    extend(other) {
        implementOrThrow(other, ['getInjectable', 'containsInjectable']);

        this.extendedContainers.push(other);
    }

    injectFunction(thisArg, fn) {
        if (typeof fn !== 'function') {
            fn = thisArg;
        }

        const params = getDefaultParams(fn);
        const injectedArgs = this._getInjectableFromParameters(params);

        return fn.apply(thisArg, injectedArgs);
    }

    // TODO: Does too much. Refactor.
    injectFolder(folderName, options = {}) {
        let calledFrom = callsites()[1].getFileName().split('/');
        calledFrom = calledFrom.slice(0, calledFrom.length - 1).join('/');

        folderName = path.resolve(calledFrom, folderName);

        const fileNames = fs.readdirSync(folderName);

        fileNames.forEach(fileName => {

            if (! fileName.endsWith('.js')) {
                return;
            }

            const value = require(path.resolve(folderName, fileName));
            const lowercaseName = fileName.toLowerCase();

            const tryType = (type) => {
                if (fileName.endsWith(`.${type}.js`)) {
                    const unSuffixed = removeSuffix(fileName, `.${type}.js`);
                    const camelName = camelcase(unSuffixed);
                    this[`put${upperCaseFirst(type)}`](camelName, value);
                    return true;
                }
                return false;
            };

            const putType = (type, val = value) => {
                const unSuffixed = removeSuffix(fileName, '.js');
                const camelName = camelcase(unSuffixed);
                this[`put${upperCaseFirst(type)}`](camelName, val);
            };

            if (typeof options.provider === 'function' && options.type) {
                throw TypeError('Container.injectFolder: Can not specify options.provider and options.type');
            }

            if (typeof options.provider === 'function') {
                return putType('provider', () => options.provider(value));
            }

            if (options.type === 'provider' || options.provider) {
                return putType('provider');
            }
            if (options.type === 'constant') {
                return putType('constant');
            }
            if (options.type === 'class') {
                return putType('class');
            }
            if (options.type === 'singleton') {
                return putType('singleton');
            }

            if (tryType('provider')) { return; }
            if (tryType('constant')) { return; }
            if (tryType('class')) { return; }
            if (tryType('singleton')) { return; }

            throw TypeError('Container.injectFolder: file name must end with .class.js, .provider.js, .constant.js or .singleton.js');

        });

    }

}

module.exports = Container;
