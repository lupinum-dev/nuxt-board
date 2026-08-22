import { BoardInputError } from '../errors.js'
import type { JsonObject, JsonValue } from '../types.js'

/** Clone, validate, and freeze a JSON-compatible value at an input boundary. */
export function freezeJsonValue(
  value: unknown,
  path: string,
  ancestors: Set<object> = new Set(),
): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new BoardInputError(`${path} must contain only finite numbers.`)
    }
    return value
  }
  if (typeof value !== 'object') {
    throw new BoardInputError(`${path} must contain only JSON values.`)
  }
  if (ancestors.has(value)) {
    throw new BoardInputError(`${path} must not contain cycles.`)
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value)
      for (const key of ownKeys) {
        if (key === 'length') continue
        if (typeof key === 'symbol' || !/^(0|[1-9]\d*)$/.test(key)) {
          throw new BoardInputError(
            `${path} must contain only indexed JSON array values.`,
          )
        }
      }
      const entries: JsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new BoardInputError(
            `${path}[${index}] must be an enumerable JSON value.`,
          )
        }
        entries.push(
          freezeJsonValue(descriptor.value, `${path}[${index}]`, ancestors),
        )
      }
      return Object.freeze(entries)
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new BoardInputError(`${path} must contain only plain objects.`)
    }
    const entries: Array<[string, JsonValue]> = []
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') {
        throw new BoardInputError(`${path} must not contain symbol keys.`)
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        throw new BoardInputError(
          `${path}.${key} must be an enumerable data property.`,
        )
      }
      entries.push([
        key,
        freezeJsonValue(descriptor.value, `${path}.${key}`, ancestors),
      ])
    }
    return Object.freeze(Object.fromEntries(entries))
  } finally {
    ancestors.delete(value)
  }
}

/** Clone, validate, and freeze a JSON object at an input boundary. */
export function freezeJsonObject(value: unknown, path: string): JsonObject {
  const cloned = freezeJsonValue(value, path)
  if (Array.isArray(cloned) || cloned === null || typeof cloned !== 'object') {
    throw new BoardInputError(`${path} must be a JSON object.`)
  }
  return cloned as JsonObject
}

/** Retain unrecognized JSON fields without allowing them to override known fields. */
export function collectJsonObjectExtras(
  value: Readonly<Record<string, unknown>>,
  knownKeys: ReadonlySet<string>,
  path = 'JSON object',
): JsonObject {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !knownKeys.has(key))
        .map(([key, entry]) => [key, freezeJsonValue(entry, `${path}.${key}`)]),
    ),
  ) as JsonObject
}
