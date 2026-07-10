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

/** Expose collection reads without leaking mutation methods or the source. */
export function readonlyMapView<K, V>(
  source: ReadonlyMap<K, V>,
): ReadonlyMap<K, V> {
  let view: ReadonlyMap<K, V>
  view = Object.freeze({
    get size() {
      return source.size
    },
    get: (key: K) => source.get(key),
    has: (key: K) => source.has(key),
    entries: () => source.entries(),
    keys: () => source.keys(),
    values: () => source.values(),
    forEach: (
      callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
      thisArg?: unknown,
    ) => {
      source.forEach((value, key) => callback.call(thisArg, value, key, view))
    },
    [Symbol.iterator]: () => source[Symbol.iterator](),
  })
  return view
}

/** Expose set reads without leaking mutation methods or the source. */
export function readonlySetView<T>(source: ReadonlySet<T>): ReadonlySet<T> {
  type SetLike<U> = {
    readonly size: number
    has(value: U): boolean
    keys(): Iterator<U>
  }
  let view: ReadonlySet<T>
  view = Object.freeze({
    get size() {
      return source.size
    },
    has: (value: T) => source.has(value),
    entries: () => source.entries(),
    keys: () => source.keys(),
    values: () => source.values(),
    forEach: (
      callback: (value: T, valueAgain: T, set: ReadonlySet<T>) => void,
      thisArg?: unknown,
    ) => {
      source.forEach((value) => callback.call(thisArg, value, value, view))
    },
    [Symbol.iterator]: () => source[Symbol.iterator](),
    union: <U>(other: SetLike<U>) => {
      const result = new Set<T | U>(source)
      for (const value of iteratorValues(other.keys())) result.add(value)
      return result
    },
    intersection: <U>(other: SetLike<U>) => {
      const result = new Set<T & U>()
      for (const value of source) {
        if (other.has(value as unknown as U)) result.add(value as T & U)
      }
      return result
    },
    difference: <U>(other: SetLike<U>) => {
      const result = new Set<T>()
      for (const value of source) {
        if (!other.has(value as unknown as U)) result.add(value)
      }
      return result
    },
    symmetricDifference: <U>(other: SetLike<U>) => {
      const result = new Set<T | U>(source)
      for (const value of iteratorValues(other.keys())) {
        if (source.has(value as unknown as T)) result.delete(value)
        else result.add(value)
      }
      return result
    },
    isSubsetOf: (other: SetLike<unknown>) => {
      for (const value of source) if (!other.has(value)) return false
      return true
    },
    isSupersetOf: (other: SetLike<unknown>) => {
      for (const value of iteratorValues(other.keys())) {
        if (!source.has(value as T)) return false
      }
      return true
    },
    isDisjointFrom: (other: SetLike<unknown>) => {
      for (const value of source) if (other.has(value)) return false
      return true
    },
  })
  return view
}

function* iteratorValues<T>(iterator: Iterator<T>): Iterable<T> {
  while (true) {
    const result = iterator.next()
    if (result.done) return
    yield result.value
  }
}
