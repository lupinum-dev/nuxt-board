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
      return Object.freeze(
        value.map((entry, index) =>
          freezeJsonValue(entry, `${path}[${index}]`, ancestors),
        ),
      )
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new BoardInputError(`${path} must contain only plain objects.`)
    }
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          freezeJsonValue(entry, `${path}.${key}`, ancestors),
        ]),
      ),
    )
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
