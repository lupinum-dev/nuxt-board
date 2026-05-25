import type { NodeId } from '../types.js'

export function createNodeId(): NodeId {
  return crypto.randomUUID() as NodeId
}
