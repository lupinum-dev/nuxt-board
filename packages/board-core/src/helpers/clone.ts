export function freezeClone<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      freezeClone(entry)
    }
    return Object.freeze(value)
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeClone(child)
    }
    return Object.freeze(value)
  }
  return value
}

export function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}
