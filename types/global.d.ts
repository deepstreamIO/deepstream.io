declare namespace NodeJS {
  export interface Global {
    deepstreamCLI: any
    deepstreamLibDir: string | null
    deepstreamConfDir: string | null
    require (path: string): any
    cluster: any // Used by e2e tests
  }
}