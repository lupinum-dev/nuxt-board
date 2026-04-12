import type { Component } from 'vue';
import type { GridPattern } from '@canvas/core';
export interface CanvasGridOptions {
    visible?: boolean;
    size?: number;
    majorEvery?: number;
    snap?: boolean;
    pattern?: GridPattern;
    minorOpacity?: number;
    majorOpacity?: number;
    fadeEdges?: boolean;
}
export interface ResolvedCanvasGridOptions {
    visible: boolean;
    size: number;
    majorEvery: number;
    snap: boolean;
    pattern: GridPattern;
    minorOpacity: number;
    majorOpacity: number;
    fadeEdges: boolean;
}
export type CanvasRendererRegistry = Record<string, Component>;
export declare const DEFAULT_CANVAS_GRID_OPTIONS: Pick<ResolvedCanvasGridOptions, 'visible' | 'pattern' | 'minorOpacity' | 'majorOpacity' | 'fadeEdges'>;
