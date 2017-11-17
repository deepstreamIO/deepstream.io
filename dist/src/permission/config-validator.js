"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_schema_1 = require("./config-schema");
const pathParser = require("./path-parser");
const ruleParser = require("./rule-parser");
const validationSteps = {};
/**
 * Validates a configuration object. This method runs through multiple
 * individual validation steps. If any of them returns false,
 * the validation fails
 */
exports.validate = function (config) {
    let validationStepResult;
    let key;
    for (key in validationSteps) {
        validationStepResult = validationSteps[key](config);
        if (validationStepResult !== true) {
            return validationStepResult;
        }
    }
    return true;
};
/**
 * Checks if the configuration is an object
 */
validationSteps.isValidType = function (config) {
    if (typeof config === 'object') {
        return true;
    }
    return `config should be an object literal, but was of type ${typeof config}`;
};
/**
 * Makes sure all sections (record, event, rpc) are present
 */
validationSteps.hasRequiredTopLevelKeys = function (config) {
    for (const key in config_schema_1.default) {
        if (typeof config[key] !== 'object') {
            return `missing configuration section "${key}"`;
        }
    }
    return true;
};
/**
 * Makes sure no unsupported sections were added
 */
validationSteps.doesNotHaveAdditionalTopLevelKeys = function (config) {
    for (const key in config) {
        if (typeof config_schema_1.default[key] === 'undefined') {
            return `unexpected configuration section "${key}"`;
        }
    }
    return true;
};
/**
 * Checks if the configuration contains valid path definitions
 */
validationSteps.doesOnlyContainValidPaths = function (config) {
    let key;
    let path;
    let result;
    for (key in config_schema_1.default) {
        // Check empty
        if (Object.keys(config[key]).length === 0) {
            return `empty section "${key}"`;
        }
        // Check valid
        for (path in config[key]) {
            result = pathParser.validate(path);
            if (result !== true) {
                return `${result} for path ${path} in section ${key}`;
            }
        }
    }
    return true;
};
/**
 * Each section must specify a generic permission ("*") that
 * will be applied if no other permission is applicable
 *
 * @param   {Object} config parsed permission config
 *
 * @private
 * @returns {Boolean}
 */
validationSteps.doesHaveRootEntries = function (config) {
    let sectionName;
    for (sectionName in config_schema_1.default) {
        if (!config[sectionName]['*']) {
            return `missing root entry "*" for section ${sectionName}`;
        }
    }
    return true;
};
/**
 * Runs the rule validator against every rule in each section
 */
validationSteps.hasValidRules = function (config) {
    let path;
    let ruleType;
    let section;
    let validationResult;
    for (section in config) {
        for (path in config[section]) {
            for (ruleType in config[section][path]) {
                if (config_schema_1.default[section][ruleType] !== true) {
                    return `unknown rule type ${ruleType} in section ${section}`;
                }
                validationResult = ruleParser.validate(config[section][path][ruleType], section, ruleType);
                if (validationResult !== true) {
                    return validationResult;
                }
            }
        }
    }
    return true;
};
//# sourceMappingURL=config-validator.js.map