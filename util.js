module.exports = {
    deleteAll,
    getAllMethods,
    getDefaultParams,
    getMethodsWithPrefix,
    lowerCaseFirst,
    delimiterParser,
    removePrefix,
    throwIfDefined,

    getRawParameters,
    splitRawParams,
    hasMethods,
    implementOrThrow,
    isDefined,
    removeSuffix,
    upperCaseFirst,
};

function deleteAll(obj, attrs) {
    attrs.forEach(attr => delete obj[attr]);
}

function throwIfDefined(value, msg) {
    if (value !== undefined) {
        throw TypeError(msg);
    }
}

function removePrefix(original, prefix) {
    return original.substring(prefix.length, original.length);
}

function removeSuffix(original, suffix) {
    return original.substring(0, original.length - suffix.length);
}

function lowerCaseFirst(string) {
    return string[0].toLowerCase() + string.substring(1, string.length);
}

function upperCaseFirst(string) {
    return string[0].toUpperCase() + string.substring(1, string.length);
}

function delimiterParser(someJavascript, conditions, postCondition) {
    const string = someJavascript.toString();

    if (! Array.isArray(conditions)) {
        conditions = [conditions];
    }

    const balance = {
        allZero() {
            return this.paren === 0 && this.curly === 0 && this.brack === 0;
        },
        paren: 0,
        curly: 0,
        brack: 0,
        comments: {
            single: 0,
            multi: 0
        }
    };

    for (let i = 0; i < string.length; i++) {

        const pairBefore = function (start, end) {
            if (! Array.isArray(start)) {
                start = [start];
            }
            if (! Array.isArray(end)) {
                end = [end];
            }

            const matches = start.filter(token => token === string.substring(i, i + token.length));

            if (matches.length) {
                i += matches[0].length - 1;

                return 1;
            }

            return 0;
        };

        const pairAfter = function (start, end) {
            if (! Array.isArray(start)) {
                start = [start];
            }
            if (! Array.isArray(end)) {
                end = [end];
            }

            const matches = end.filter(token => token === string.substring(i, i + token.length));

            if (matches.length) {
                i += matches[0].length - 1;
                return -1;
            }

            return 0;
        };

        const trap = function (start, end) {
            if (! Array.isArray(start)) {
                start = [start];
            }
            if (! Array.isArray(end)) {
                end = [end];
            }

            for (const startToken of start) {
                if (startToken === string.substring(i, i + startToken.length)) {
                    i += startToken.length;

                    while (true) {
                        if (i >= string.length) {
                            throw Error('Trap out of bounds');
                        }
                        for (const endToken of end) {
                            if (endToken === string.substring(i, i + endToken.length)) {
                                i += endToken.length - 1;
                                return true;
                            }
                        }
                        i++;
                    }
                }
            }
        };

        const isNext = function (str) {
            return string.substring(i, i + str.length) === str;
        };

        const letter = string[i];

        // pre condition parsing
        balance.paren += pairBefore('(', ')');
        balance.curly += pairBefore('{', '}');
        balance.brack += pairBefore('[', ']');

        if (trap('/*', '*/')) {
            continue;
        }
        if (trap('//', ['\n', '\r'])) {
            continue;
        }

        // call all conditions unless in comment
        if (! balance.comments.single && ! balance.comments.multi) {
            let inc;

            conditions.some(condition => {
                inc = condition(balance, string, i, isNext);

                if (typeof inc === 'number') {
                    i += inc;
                    return true;
                }
            });
        }

        // post condition parsing
        balance.paren += pairAfter('(', ')');
        balance.curly += pairAfter('{', '}');
        balance.brack += pairAfter('[', ']');
    }

    postCondition && postCondition(balance, string);

}

function getAllMethods(clazz) {
    const methodNames = [];
    let raw = [];

    delimiterParser(clazz.toString(), [
        (balance, string, i) => {
            if (balance.curly === 1 && string[i].trim() && balance.paren === 0 && ! ['{','}'].includes(string[i])) {
                raw.push(string[i]);
            } else if (raw.length) {
                methodNames.push(raw.join(''));
                raw = [];
            }
        }
    ]);

    return methodNames;
}

function getMethodsWithPrefix(clazz, prefix) {
    return getAllMethods(clazz)
        .filter(methodName => methodName.startsWith(prefix));
}

function getDefaultParams(fn) {
    const splitRaw = splitRawParams(getRawParameters(fn));

    const result = {};

    for (const param of splitRaw) {
        let isDone = false;

        delimiterParser(param, [
            (balance, string, i, isNext) => {
                if (isDone) { return; }

                const isAssignment = string[i] === '=';

                if (balance.allZero() && string[i] === '=') {
                    const key = string.substring(0, i).trim();
                    const val = string.substring(i+1, string.length).trim();

                    result[key] = val;

                    isDone = true;
                }
            }
        ]);

        if (! isDone) {
            result[param] = null;
        }
    }

    return result;
}

function splitRawParams(raw) {

    let current = [];
    let delim;
    const result = [];

    delimiterParser(raw, [
        (balance, string, i, isNext) => {

            // case: strings
            if (string[i] === '\'' || string[i] === '"') {
                delim = string[i];
                current.push(string[i]);
                while (true) {
                    i++;
                    current.push(string[i]);
                    if (string[i] === '\\') {
                        i++;
                        current.push(string[i]);
                        continue;
                    }
                    if (string[i] === delim) {
                        break;
                    }
                }
                return i;
            }

            // case split
            else if (string[i] === ',' && balance.allZero()) {
                result.push(current.join('').trim());
                current = [];
            }

            else {
                current.push(string[i]);
            }
        }
    ]);

    if (current.length) {
        result.push(current.join('').trim());
    }

    return result;
}

function getRawParameters(fn) {
    let raw = [];
    let isDone = false;
    let stripParen = false;

    delimiterParser(fn.toString(), [
        (balance, string, i, isNext) => {
            if (isDone) { return; }

            // case: () arguments
            if (balance.paren >= 1) {
                raw.push(string[i]);
                stripParen = true;
                return;
            }

            // case (param)=>...
            if (raw.length && balance.paren === 0) {
                isDone = true;
                return;
            }

            // case: arg => {}
            if (balance.curly === 0 && isNext('=>')) {
                isDone = true;
                raw.push(string.substring(0, i));
                return;
            }

            /*
               if (balance.curly === 0 && balance.paren === 1 && ! ['(',')'].includes()) {
               console.log()
               }
               */
        }
    ]);

    raw = raw.join('');

    if (stripParen) {
        raw = raw.substring(1, raw.length - 1);
    }

    return raw;
}

function hasMethods(instance, methods) {
    for (const method of methods) {
        if (typeof instance[method] !== 'function') {
            return false;
        }
    }
    return true;
}

function implementOrThrow(instance, methods) {
    if (! hasMethods(instance, methods)) {
        throw TypeError('Object does not implement methods: ' + JSON.stringify(methods));
    }
}

function isDefined(val) {
    return val !== undefined;
}
