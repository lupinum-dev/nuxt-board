import type { CanvasNode, ResizeHandle } from './types';
export interface ResizeConstraints {
    minWidth: number;
    minHeight: number;
}
type NodeBounds = Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
export declare function applyResizeDelta(node: NodeBounds, handle: ResizeHandle, deltaX: number, deltaY: number, constraints: ResizeConstraints): NodeBounds;
export declare function snapResizedBounds(bounds: NodeBounds, handle: ResizeHandle, gridSize: number, constraints: ResizeConstraints): NodeBounds;
/**
 * Aspect-ratio-locked variant of applyResizeDelta.
 *
 * For corner handles the dominant axis (larger normalised delta) drives the
 * resize and the other axis is computed from `aspectRatio = width / height`.
 * For edge handles the active axis drives and the perpendicular axis is
 * derived, effectively upgrading the handle to its nearest corner.
 */
export declare function applyResizeDeltaLocked(node: NodeBounds, handle: ResizeHandle, deltaX: number, deltaY: number, constraints: ResizeConstraints, aspectRatio: number): NodeBounds;
/**
 * Aspect-ratio-preserving snap.  Snaps the primary dimension to the grid
 * and derives the secondary exactly from the ratio so the shape stays true.
 *
 * For N / S handles height is primary; for everything else width is primary.
 * `startBounds` is needed to keep the fixed edge anchored after snapping.
 */
export declare function snapResizedBoundsLocked(bounds: NodeBounds, startBounds: NodeBounds, handle: ResizeHandle, gridSize: number, constraints: ResizeConstraints, aspectRatio: number): NodeBounds;
export {};
