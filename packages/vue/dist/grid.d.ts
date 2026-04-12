export interface CanvasGridOptions {
    visible?: boolean;
    size?: number;
    majorEvery?: number;
    snap?: boolean;
    minorOpacity?: number;
    majorOpacity?: number;
    fadeEdges?: boolean;
}
export interface ResolvedCanvasGridOptions {
    visible: boolean;
    size: number;
    majorEvery: number;
    snap: boolean;
    minorOpacity: number;
    majorOpacity: number;
    fadeEdges: boolean;
}
export declare const DEFAULT_CANVAS_GRID_OPTIONS: Pick<ResolvedCanvasGridOptions, 'visible' | 'minorOpacity' | 'majorOpacity' | 'fadeEdges'>;
