import { CanvasEngine, Bounds, CanvasNode, NodeId } from '@canvas/core';

declare function getSelectionNodes(engine: CanvasEngine): CanvasNode[];
declare function getSelectionBounds(engine: CanvasEngine): Bounds | null;
declare function toggleIds(current: NodeId[], ids: NodeId[]): NodeId[];

export { getSelectionBounds, getSelectionNodes, toggleIds };
