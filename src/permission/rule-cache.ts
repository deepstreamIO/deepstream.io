export default class RuleCache {
  private config: ValveConfig
  private data: any
  private interval: any

  /**
   * This cache stores rules that are frequently used. It removes
   * unused rules after a preset interval
   */
  constructor (config: ValveConfig) {
    this.config = config
    this.data = {}
    this.interval = setInterval(this.purge.bind(this), config.cacheEvacuationInterval)
  }

  /**
   * Empties the rulecache completely
   */
  public reset (): void {
    this.data = {}
  }

  /**
   * Checks if an entry for a specific rule in a specific section is
   * present
   */
  public has (section: string, name: string, type: string): boolean {
    return !!this.data[toKey(section, name, type)]
  }

  /**
   * Resets the usage flag and returns an entry from the cache
   */
  public get (section: string, name: string, type: string) {
    const key = toKey(section, name, type)
    this.data[key].isUsed = true
    return this.data[key].rule
  }

  /**
   * Adds an entry to the cache
   */
  public set (section: string, name: string, type: string, rule: any): void {
    this.data[toKey(section, name, type)] = {
      rule,
      isUsed: true,
    }
  }

  /**
   * This method is called repeatedly on an interval, defined by
   * cacheEvacuationInterval.
   *
   * If a rule in the cache has been used in the last interval, it sets its isUsed flag to false.
   * Whenever the rule is used, the isUsed flag will be set to true
   * Any rules that haven't been used in the next cycle will be removed from the cache
   */
  private purge () {
    for (const key in this.data) {
      if (this.data[key].isUsed === true) {
        this.data[key].isUsed = false
      } else {
        delete this.data[key]
      }
    }
  }
}

/**
 * Creates a key from the various set parameters
 */
function toKey (section: string, name: string, type: string): string {
  return `${section}_${name}_${type}`
}
