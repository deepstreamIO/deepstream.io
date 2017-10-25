"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
/**
 * Returns a unique identifier
 */
exports.getUid = function () {
    return `${Date.now().toString(36)}-${(Math.random() * 10000000000000000000).toString(36)}`;
};
/**
 * Calls <callback> once all <emitters> have emitted <event>
 */
exports.combineEvents = function (emitters, event, callback) {
    let i;
    let count = 0;
    const increment = function () {
        count++;
        if (count === emitters.length) {
            callback();
        }
    };
    for (i = 0; i < emitters.length; i++) {
        emitters[i].once(event, increment);
    }
};
/**
 * Takes a key-value map and returns
 * a map with { value: key } of the old map
 */
exports.reverseMap = function (map) {
    const reversedMap = {};
    for (const key in map) {
        reversedMap[map[key]] = key;
    }
    return reversedMap;
};
/**
 * Extended version of the typeof operator. Also supports 'array'
 * and 'url' to check for valid URL schemas
 */
exports.isOfType = function (input, expectedType) {
    if (input === null) {
        return expectedType === 'null';
    }
    else if (expectedType === 'array') {
        return Array.isArray(input);
    }
    else if (expectedType === 'url') {
        return !!url.parse(input).host;
    }
    return typeof input === expectedType;
};
/**
 * Takes a map and validates it against a basic
 * json schema in the form { key: type }
 * @returns {Boolean|Error}
 */
exports.validateMap = function (map, throwError, schema) {
    let error;
    let key;
    for (key in schema) {
        if (typeof map[key] === 'undefined') {
            error = new Error(`Missing key ${key}`);
            break;
        }
        if (!exports.isOfType(map[key], schema[key])) {
            error = new Error(`Invalid type ${typeof map[key]} for ${key}`);
            break;
        }
    }
    if (error) {
        if (throwError) {
            throw error;
        }
        else {
            return error;
        }
    }
    else {
        return true;
    }
};
/**
 * Multi Object recoursive merge
 * @param {Object} multiple objects to be merged into each other recoursively
 */
exports.merge = function (...args) {
    const result = {};
    const objs = Array.prototype.slice.apply(arguments);
    let i;
    const internalMerge = (objA, objB) => {
        let key;
        for (key in objB) {
            if (objB[key] && objB[key].constructor === Object) {
                objA[key] = objA[key] || {};
                internalMerge(objA[key], objB[key]);
            }
            else if (objB[key] !== undefined) {
                objA[key] = objB[key];
            }
        }
    };
    for (i = 0; i < objs.length; i++) {
        internalMerge(result, objs[i]);
    }
    return result;
};
/**
 * Set timeout utility that adds support for disabling a timeout
 * by passing null
 */
exports.setTimeout = function (callback, timeoutDuration) {
    if (timeoutDuration !== null) {
        return exports.setTimeout(callback, timeoutDuration);
    }
    return -1;
};
/**
 * Set Interval utility that adds support for disabling an interval
 * by passing null
 */
exports.setInterval = function (callback, intervalDuration) {
    if (intervalDuration !== null) {
        return exports.setInterval(callback, intervalDuration);
    }
    return -1;
};
exports.getRandomIntInRange = function (min, max) {
    return min + Math.floor(Math.random() * (max - min));
};
exports.spliceRandomElement = function (array) {
    const randomIndex = exports.getRandomIntInRange(0, array.length);
    return array.splice(randomIndex, 1)[0];
};
/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
exports.shuffleArray = function (array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
};
/*
 * Recursively freeze a deeply nested object
 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
exports.deepFreeze = function (obj) {
    // Retrieve the property names defined on obj
    const propNames = Object.getOwnPropertyNames(obj);
    // Freeze properties before freezing self
    propNames.forEach(name => {
        const prop = obj[name];
        // Freeze prop if it is an object
        if (typeof prop === 'object' && prop !== null) {
            exports.deepFreeze(prop);
        }
    });
    // Freeze self (no-op if already frozen)
    return Object.freeze(obj);
};
//# sourceMappingURL=utils.js.map