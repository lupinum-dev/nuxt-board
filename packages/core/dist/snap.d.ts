import type { CanvasNode, NodeId, ResizeHandle, SnapAxis, SnapGuide } from './types';
interface EdgeCandidate {
    axis: SnapAxis;
    value: number;
    extentMin: number;
    extentMax: number;
}
export interface SnapResult {
    bounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
    guides: SnapGuide[];
}
export interface DragSnapResult {
    dx: number;
    dy: number;
    guides: SnapGuide[];
}
export declare function collectNodeEdges(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>): EdgeCandidate[];
export declare function collectOtherNodeEdges(nodes: Iterable<CanvasNode>, excludeId: NodeId): EdgeCandidate[];
export declare function collectOtherNodeEdgesExcluding(nodes: Iterable<CanvasNode>, excludeIds: Set<NodeId>): EdgeCandidate[];
export declare function snapBoundsToEdges(bounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, handle: ResizeHandle, otherEdges: EdgeCandidate[], threshold: number): SnapResult;
export declare function snapPositionToEdges(bounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, otherEdges: EdgeCandidate[], threshold: number): DragSnapResult;
export {};
