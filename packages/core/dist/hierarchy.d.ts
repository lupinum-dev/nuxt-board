import type { Bounds, CanvasNode, NodeId } from './types';
export declare function getBoundsFromNode(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>): Bounds;
export declare function groupArea(node: CanvasNode): number;
/** Add every descendant of `rootId` into `out` (recursive; includes nested groups). */
export declare function addDescendants(rootId: NodeId, nodes: Map<NodeId, CanvasNode>, out: Set<NodeId>): void;
export declare function expandGroupDragSeeds(seedIds: Iterable<NodeId>, nodes: Map<NodeId, CanvasNode>): Set<NodeId>;
export declare function collectSubtreeIds(rootId: NodeId, nodes: Map<NodeId, CanvasNode>, into: Set<NodeId>): void;
/**
 * Seeds expanded with group descendants, then union of subtrees rooted at nodes whose parent is outside the expanded set.
 * Each node appears once; applying the same delta to all ids moves a coherent forest.
 */
export declare function collectUniformTranslationTargets(seedIds: Iterable<NodeId>, nodes: Map<NodeId, CanvasNode>): NodeId[];
/** True if `maybeDescendant` is reachable by following parentId from `maybeDescendant` up to `ancestorId`. */
export declare function isStrictDescendantOf(maybeDescendant: NodeId, ancestorId: NodeId, nodes: Map<NodeId, CanvasNode>): boolean;
export declare function findContainingGroup(node: CanvasNode, nodes: Map<NodeId, CanvasNode>): NodeId | undefined;
export declare function sortIdsByZIndex(ids: NodeId[], nodes: Map<NodeId, CanvasNode>): NodeId[];
