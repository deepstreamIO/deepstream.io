import { ValveConfig } from '@deepstream/types'

interface CachedRule {
  rule: string,
  isUsed: boolean,
}

export default class RuleCache {
  private data = new Map<string, CachedRule>()
  private purgeInterval: NodeJS.Timer

  /**
   * This cache stores rules that are frequently used. It removes
   * unused rules after a preset interval
   */
  constructor (config: ValveConfig) {
    this.purgeInterval = setInterval(this.purge.bind(this), config.cacheEvacuationInterval)
  }

  public close () {
    clearInterval(this.purgeInterval)
  }

  /**
   * Empties the rulecache completely
   */
  public reset (): void {
    this.data.clear()
  }

  /**
   * Checks if an entry for a specific rule in a specific section is
   * present
   */
  public has (section: string, name: string, type: string): boolean {
    return this.data.has(toKey(section, name, type))
  }

  /**
   * Resets the usage flag and returns an entry from the cache
   */
  public get (section: string, name: string, type: string): string | undefined {
    const cache = this.data.get(toKey(section, name, type))
    if (cache) {
      cache.isUsed = true
      return cache.rule
    }
    return undefined
  }

  /**
   * Adds an entry to the cache
   */
  public set (section: string, name: string, type: string, rule: string): void {
    this.data.set(toKey(section, name, type), {
      rule,
      isUsed: true,
    })
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
    for (const [key, cache] of this.data) {
      if (cache.isUsed === true) {
        cache.isUsed = false
      } else {
        this.data.delete(key)
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
