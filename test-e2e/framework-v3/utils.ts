export const defaultDelay: number = Number(process.env.DEFAULT_DELAY) || 10

export const parseData = (data: string) => {
  if (data === undefined || data === 'undefined') {
    return undefined
  } else if (data === 'null') {
    return null
  }
  try {
    return JSON.parse(data)
  } catch (e) {
    return data
  }
}
