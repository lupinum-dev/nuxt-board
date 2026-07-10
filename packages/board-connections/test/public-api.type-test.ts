import { createBoardEngine } from '@lupinum/board-core'
import { connectionsPlugin } from '../src'

const bare = createBoardEngine()
// @ts-expect-error Connections are unavailable unless their plugin is installed.
bare.plugins.connections.getEdges()

const connected = createBoardEngine({ plugins: [connectionsPlugin()] })
connected.plugins.connections.getEdges()
