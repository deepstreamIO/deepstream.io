"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RuleCache {
    /**
     * This cache stores rules that are frequently used. It removes
     * unused rules after a preset interval
     */
    constructor(config) {
        this.config = config;
        this.data = {};
        this.interval = setInterval(this.purge.bind(this), config.cacheEvacuationInterval);
    }
    /**
     * Empties the rulecache completely
     */
    reset() {
        this.data = {};
    }
    /**
     * Checks if an entry for a specific rule in a specific section is
     * present
     */
    has(section, name, type) {
        return !!this.data[toKey(section, name, type)];
    }
    /**
     * Resets the usage flag and returns an entry from the cache
     */
    get(section, name, type) {
        const key = toKey(section, name, type);
        this.data[key].isUsed = true;
        return this.data[key].rule;
    }
    /**
     * Adds an entry to the cache
     */
    set(section, name, type, rule) {
        this.data[toKey(section, name, type)] = {
            rule,
            isUsed: true,
        };
    }
    /**
     * This method is called repeatedly on an interval, defined by
     * cacheEvacuationInterval.
     *
     * If a rule in the cache has been used in the last interval, it sets its isUsed flag to false.
     * Whenever the rule is used, the isUsed flag will be set to true
     * Any rules that haven't been used in the next cycle will be removed from the cache
     */
    purge() {
        for (const key in this.data) {
            if (this.data[key].isUsed === true) {
                this.data[key].isUsed = false;
            }
            else {
                delete this.data[key];
            }
        }
    }
}
exports.default = RuleCache;
/**
 * Creates a key from the various set parameters
 */
function toKey(section, name, type) {
    return `${section}_${name}_${type}`;
}
//# sourceMappingURL=rule-cache.js.map