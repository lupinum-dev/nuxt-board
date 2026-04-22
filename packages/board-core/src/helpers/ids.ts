import type { NodeId } from '../types'

export function createNodeId(): NodeId {
  return crypto.randomUUID() as NodeId
}
