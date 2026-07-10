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
