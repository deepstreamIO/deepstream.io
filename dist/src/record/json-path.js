"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SPLIT_REG_EXP = /[[\]]/g;
/**
 * This class allows to set or get specific
 * values within a json data structure using
 * string-based paths
 */
function setValue(root, path, value) {
    const tokens = tokenize(path);
    let node = root;
    let i;
    for (i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        if (node[token] !== undefined && typeof node[token] === 'object') {
            node = node[token];
        }
        else if (typeof tokens[i + 1] === 'number') {
            node = node[token] = [];
        }
        else {
            node = node[token] = {};
        }
    }
    node[tokens[i]] = value;
}
exports.setValue = setValue;
/**
 * Parses the path. Splits it into
 * keys for objects and indices for arrays.
 */
function tokenize(path) {
    const tokens = [];
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.length === 0) {
            continue;
        }
        const arrayIndexes = part.split(SPLIT_REG_EXP);
        if (arrayIndexes.length === 0) {
            // TODO
            continue;
        }
        tokens.push(arrayIndexes[0]);
        for (let j = 1; j < arrayIndexes.length; j++) {
            if (arrayIndexes[j].length === 0) {
                continue;
            }
            tokens.push(Number(arrayIndexes[j]));
        }
    }
    return tokens;
}
//# sourceMappingURL=json-path.js.map