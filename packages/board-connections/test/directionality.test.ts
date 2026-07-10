import { describe, expect, it } from 'vitest'
import { edgeEndsForDirectionality } from '../src/directionality.js'

describe('edgeEndsForDirectionality', () => {
  it.each([
    ['none', { fromEnd: 'none', toEnd: 'none' }],
    ['start', { fromEnd: 'arrow', toEnd: 'none' }],
    ['end', { fromEnd: 'none', toEnd: 'arrow' }],
    ['both', { fromEnd: 'arrow', toEnd: 'arrow' }],
  ] as const)('maps %s to endpoint markers', (directionality, expected) => {
    expect(edgeEndsForDirectionality(directionality)).toEqual(expected)
  })
})
