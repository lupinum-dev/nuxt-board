import { describe, expect, it } from 'vitest'
import { createCanvasEngine } from '@canvas/core'
import { connectionPlugin } from '@canvas/connections'
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

  it('round-trips custom node types without a registered handler via x-canvas:data', () => {
    const serializer = jsonCanvasSerializer
    const engine = createCanvasEngine()
    engine.createNode({ type: 'video', x: 50, y: 50, data: { src: '/clip.mp4', duration: 42 } })

    const json = serializer.export(engine.getSnapshot())
    const snapshot = serializer.toSnapshot(serializer.parse(json))

    expect(snapshot.nodes[0]).toMatchObject({
      type: 'video',
      data: { src: '/clip.mp4', duration: 42 }
    })
  })

  it('preserves engine metadata and connection edges through the extension namespace', () => {
    const engine = createCanvasEngine({
      plugins: [connectionPlugin()]
    })
    const first = engine.createNode({
      type: 'text',
      x: 10,
      y: 20,
      locked: true,
      visible: false,
      data: { content: 'Hidden' }
    })
    const second = engine.createNode({
      type: 'text',
      x: 240,
      y: 120,
      data: { content: 'Visible' }
    })
    engine.sendToBack(first.id)
    engine.createEdge?.({ from: first.id, to: second.id, data: { label: 'Link' } })

    const document = jsonCanvasSerializer.parse(jsonCanvasSerializer.export(engine))
    const snapshot = jsonCanvasSerializer.toSnapshot(document)

    expect(document['x-canvas']?.edges).toHaveLength(1)
    expect(snapshot.camera).toEqual(engine.getSnapshot().camera)
    expect(snapshot.grid).toEqual(engine.getSnapshot().grid)
    expect(snapshot.nodes.find((node) => node.id === first.id)).toMatchObject({
      locked: true,
      visible: false,
      zIndex: engine.getSnapshot().nodes.find((node) => node.id === first.id)?.zIndex
    })
  })

  it('round-trips parentId and group nodes', () => {
    const engine = createCanvasEngine({ grid: { snap: false } })
    const group = engine.createNode({
      type: 'group',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      select: false
    })
    engine.createNode({
      type: 'text',
      x: 10,
      y: 20,
      width: 80,
      height: 60,
      parentId: group.id,
      select: false,
      data: { content: 'in group' }
    })
    engine.syncGroupZOrder(group.id)

    const json = jsonCanvasSerializer.export(engine.getSnapshot())
    const snapshot = jsonCanvasSerializer.toSnapshot(jsonCanvasSerializer.parse(json))
    const child = snapshot.nodes.find((n) => n.type === 'text')
    expect(child?.parentId).toBe(group.id)
    expect(snapshot.nodes.some((n) => n.type === 'group' && n.id === group.id)).toBe(true)
  })
})
