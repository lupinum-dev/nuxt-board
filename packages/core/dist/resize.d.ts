import type { CanvasNode, ResizeHandle } from './types';
export interface ResizeConstraints {
    minWidth: number;
    minHeight: number;
}
export declare function applyResizeDelta(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, handle: ResizeHandle, deltaX: number, deltaY: number, constraints: ResizeConstraints): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
export declare function snapResizedBounds(bounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, handle: ResizeHandle, gridSize: number, constraints: ResizeConstraints): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
