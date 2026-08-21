import type { JsonCanvasPassthrough } from '../state/types.js'
import type { JsonObject, NodeId } from '../types.js'

/** Remove one canonical node's private JSON Canvas passthrough fields. */
export function removeNodeExtras(
  current: JsonCanvasPassthrough,
  id: NodeId,
): JsonCanvasPassthrough {
  if (!current.nodes.has(id)) return current
  const nodes = new Map(current.nodes)
  nodes.delete(id)
  return { ...current, nodes }
}

/** Copy private node fields through an ID remap into the canonical store. */
export function copyNodeExtras(
  current: JsonCanvasPassthrough,
  idMap: ReadonlyMap<NodeId, NodeId>,
  source: ReadonlyMap<NodeId, JsonObject> = current.nodes,
): JsonCanvasPassthrough {
  const nodes = new Map(current.nodes)
  for (const [sourceId, targetId] of idMap) {
    const extras = source.get(sourceId)
    if (extras) nodes.set(targetId, extras)
  }
  return { ...current, nodes }
}

/** Replace all private JSON Canvas fields from a normalized document. */
export function replaceJsonCanvasExtras(
  incoming: JsonCanvasPassthrough,
): JsonCanvasPassthrough {
  return {
    document: incoming.document,
    nodes: new Map(incoming.nodes),
  }
}

/** Merge normalized document fields while remapping colliding node IDs. */
export function mergeJsonCanvasExtras(
  current: JsonCanvasPassthrough,
  incoming: JsonCanvasPassthrough,
  idMap: ReadonlyMap<NodeId, NodeId>,
): JsonCanvasPassthrough {
  const document = Object.freeze({
    ...current.document,
    ...incoming.document,
  })
  const nodes = new Map(current.nodes)
  for (const [id, extras] of incoming.nodes) {
    nodes.set(idMap.get(id) ?? id, extras)
  }
  return { document, nodes }
}

/** Select private fields for nodes copied into the internal clipboard. */
export function selectNodeExtras(
  source: ReadonlyMap<NodeId, JsonObject>,
  ids: Iterable<NodeId>,
): Map<NodeId, JsonObject> {
  const selected = new Map<NodeId, JsonObject>()
  for (const id of ids) {
    const extras = source.get(id)
    if (extras) selected.set(id, extras)
  }
  return selected
}
