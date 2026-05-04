declare global {
  // eslint-disable-next-line no-var
  var deepstreamCLI: any
  // eslint-disable-next-line no-var
  var deepstreamLibDir: string | null
  // eslint-disable-next-line no-var
  var deepstreamConfDir: string | null
  // eslint-disable-next-line no-var
  var e2eHarness: any // Used by e2e tests
}

export {}