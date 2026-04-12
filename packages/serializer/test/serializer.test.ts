import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { jsonCanvasSerializer } from '../src'

describe('json canvas serializer', () => {
  it('round-trips text nodes through the json canvas format', () => {
    const engine = createCanvasEngine()
    engine.createNode({ type: 'text', x: 10, y: 20, data: { content: 'Hello' } })

    const json = jsonCanvasSerializer.export(engine.getSnapshot())
    const document = jsonCanvasSerializer.parse(json)
    const snapshot = jsonCanvasSerializer.toSnapshot(document)

    expect(snapshot.nodes[0]).toMatchObject({
      type: 'text',
      data: { content: 'Hello' }
    })
  })

  it('uses custom type handlers when registered', () => {
    jsonCanvasSerializer.registerType('image', {
      serialize: (node) => ({ src: node.data.src, alt: node.data.alt }),
      deserialize: (raw) => ({ src: raw.src, alt: raw.alt })
    })

    const engine = createCanvasEngine()
    engine.createNode({ type: 'image', x: 0, y: 0, data: { src: '/asset.png', alt: 'Asset' } })

    const json = jsonCanvasSerializer.export(engine.getSnapshot())
    const snapshot = jsonCanvasSerializer.toSnapshot(jsonCanvasSerializer.parse(json))

    expect(snapshot.nodes[0]).toMatchObject({
      type: 'image',
      data: { src: '/asset.png', alt: 'Asset' }
    })
  })
})
