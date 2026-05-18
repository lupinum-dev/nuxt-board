import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { asNodeId, createBoardEngine } from '@lupinum/board-core'
import { createDemoDocument } from '../apps/docs/app/utils/demoDocument'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('docs demo contracts', () => {
  it('keeps docs as an app, not a publishable package', () => {
    expect(() => read('apps/docs/package.json')).not.toThrow()
    expect(() => read('packages/docs/package.json')).toThrow()
  })

  it('does not pass runtime snapshots directly to importJSON in demos', () => {
    const files = readdirSync(resolve(root, 'apps/docs/app/components/demos'))
      .filter((file) => file.endsWith('.vue'))
      .map((file) => `apps/docs/app/components/demos/${file}`)

    for (const file of files) {
      const source = read(file)

      expect(source, file).not.toMatch(/importJSON\(\s*JSON\.stringify\(\s*\{/s)
      expect(source, file).not.toMatch(/\bsnapGuides:\s*\[/)
      expect(source, file).not.toMatch(/\binteraction:\s*\{\s*mode:/)
    }

    expect(read('packages/nuxt-board/playground/lib/demo.ts')).not.toMatch(
      /importJSON\(\s*JSON\.stringify\(\s*\{/s,
    )
  })

  it('imports canonical docs demo documents through the real engine', () => {
    const document = createDemoDocument({
      camera: { x: -20, y: -10, z: 1 },
      grid: createBoardEngine().getGridSettings(),
      selection: [asNodeId('child')],
      nextZIndex: 3,
      nodes: [
        {
          id: asNodeId('group'),
          type: 'group',
          x: 0,
          y: 0,
          width: 360,
          height: 240,
          label: 'Group',
          zIndex: 1,
          locked: false,
          visible: true,
        },
        {
          id: asNodeId('child'),
          type: 'text',
          x: 40,
          y: 40,
          width: 180,
          height: 90,
          text: 'Child',
          parentId: asNodeId('group'),
          zIndex: 2,
          locked: false,
          visible: true,
        },
      ],
    })
    const engine = createBoardEngine()

    engine.importJSON(JSON.stringify(document), 'replace')

    expect(engine.getNode(asNodeId('child')).parentId).toBe(asNodeId('group'))
    expect(JSON.parse(engine.exportJSON())).toMatchObject({
      nodes: expect.any(Array),
      'x-vue-board': {
        selection: [asNodeId('child')],
        nodes: {
          child: { parentId: asNodeId('group') },
        },
      },
    })
  })
})
