declare namespace NodeJS {
  export interface Global {
    deepstreamCLI: any
    deepstreamLibDir: string | null
    deepstreamConfDir: string | null
    require (path: string): any
    e2eHarness: any // Used by e2e tests
  }
}