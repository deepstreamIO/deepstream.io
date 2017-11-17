"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pathParser = require("./path-parser");
const ruleParser = require("./rule-parser");
/**
 * Compiles a pre-validated config into a format that allows for quicker access
 * and execution
 */
exports.compile = function (config) {
    const compiledConfig = {};
    let compiledRuleset;
    let section;
    let path;
    for (section in config) {
        compiledConfig[section] = [];
        for (path in config[section]) {
            compiledRuleset = compileRuleset(path, config[section][path]);
            compiledConfig[section].push(compiledRuleset);
        }
    }
    return compiledConfig;
};
/**
 * Compiles an individual ruleset
 */
function compileRuleset(path, rules) {
    const ruleset = pathParser.parse(path);
    ruleset.rules = {};
    for (const ruleType in rules) {
        ruleset.rules[ruleType] = ruleParser.parse(rules[ruleType], ruleset.variables);
    }
    return ruleset;
}
//# sourceMappingURL=config-compiler.js.map