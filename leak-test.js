const Container = require('./container');
const mainContainer = new Container();
const memwatch = require('memwatch-next');

console.log('Testing memory usage');
let iteration = 0;
let leakCount = 0;
let intId = null;
const warmupIterations = 10;

console.log('Warming up with ' + warmupIterations + ' iterations to prevent false positives.');

const start = new Date();

process.on('SIGINT', () => {
    clearInterval(intId);

    if (iteration < warmupIterations) {
        return console.log('Did not complete warmup iterations');
    }

    const runTime = (new Date() - start) / 1000;

    console.log('\n\nTested ' + (iteration - warmupIterations) + ' iterations. Leaked ' + leakCount + ' times. Ran for ' + runTime + ' seconds.\n');
});

intId = setInterval(() => {
    iteration += 1;

    const transientContainer = new Container();

    // Let some iterations run to warm up
    if (iteration === warmupIterations) {
        console.log('\n\nWarmup complete!\n');
        memwatch.on('leak', info => {
            leakCount++;
            console.log('\n', info, '\nMemory usage:' + process.memoryUsage(), '\n');
        });
    }

    process.stdout.write('.');

    // constants
    for (let i = 0; i < 10; i++) {
        const key = 'x' + (Math.random()+'').replace('.', '');
        if (transientContainer.containsInjectable(key)) {
            continue;
        }
        transientContainer.putConstant(key, Math.random());
        transientContainer.getInjectable(key);
    }

    // providers
    for (let i = 0; i < 10; i++) {
        const key = 'x' + (Math.random()+'').replace('.', '');
        if (transientContainer.containsInjectable(key)) {
            continue;
        }
        transientContainer.putProvider(key, () => {
            return Math.random();
        });
        transientContainer.getInjectable(key);
    }

    // classes
    for (let i = 0; i < 10; i++) {
        class MyClass {}
        const key = 'x' + (Math.random()+'').replace('.', '');
        if (transientContainer.containsInjectable(key)) {
            continue;
        }
        transientContainer.putClass(key, MyClass);
        transientContainer.getInjectable(key);
    }

    // singletons
    for (let i = 0; i < 10; i++) {
        class MyClass {}
        const key = 'x' + (Math.random()+'').replace('.', '');
        if (transientContainer.containsInjectable(key)) {
            continue;
        }
        transientContainer.putSingleton(key, MyClass);
        transientContainer.getInjectable(key);
    }

    global.gc();

}, 20);

function median(array) {
    array.sort();
    if (array.length % 2 !== 0) {
        return array.length / 2;
    }
    return (array[array.length / 2] + array[array.length / 2 - 1]) / 2;
}
