import { CanvasEngine, Bounds, CanvasNode, CanvasPlugin, NodeId } from '@canvas/core';

declare function selectionPlugin(): CanvasPlugin;
declare function getSelectionNodes(engine: CanvasEngine): CanvasNode[];
declare function getSelectionBounds(engine: CanvasEngine): Bounds | null;
declare function toggleIds(current: NodeId[], ids: NodeId[]): NodeId[];

export { getSelectionBounds, getSelectionNodes, selectionPlugin, toggleIds };
