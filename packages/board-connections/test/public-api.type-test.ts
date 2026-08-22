import { createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '../src'

const bare = createBoardEngine()
// @ts-expect-error Connections are unavailable unless their plugin is installed.
bare.plugins.connections.getEdges()
// @ts-expect-error Connection events are unavailable without the plugin.
bare.on('edge:created', () => undefined)

const connected = createBoardEngine({ plugins: [connectionsPlugin()] })
connected.plugins.connections.getEdges()
connected.on('edge:created', (edge) => edge.id)
const existing = connected.plugins.connections.getEdges()[0]!
// @ts-expect-error updateEdge cannot let callers invent a narrower data shape.
const invented: { readonly data: { readonly invented: true } } =
  connected.plugins.connections.updateEdge(existing.id, {})

declare const enableConnections: boolean
const conditionalPlugins = enableConnections
  ? ([connectionsPlugin()] as const)
  : ([] as const)
const conditional = createBoardEngine({ plugins: conditionalPlugins })
// @ts-expect-error A conditionally installed plugin is not guaranteed to exist.
conditional.plugins.connections.getEdges()
// @ts-expect-error Conditional plugin events are not guaranteed to exist.
conditional.on('edge:created', () => undefined)
