import { type ComputedRef, type PropType } from 'vue';
import type { Bounds, CanvasEngine, CanvasNode, Point } from '@canvas/core';
export interface MinimapOptions {
    width?: number;
    height?: number;
    padding?: number;
}
export declare function useMinimap(engine: CanvasEngine, options?: MinimapOptions): {
    bounds: ComputedRef<Bounds>;
    viewportRect: ComputedRef<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    minimapNodes: ComputedRef<Array<{
        node: CanvasNode;
        x: number;
        y: number;
        width: number;
        height: number;
    }>>;
    panToMinimapPoint: (point: Point) => Promise<void>;
};
export declare const CanvasMinimap: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | null>;
        default: null;
    };
    width: {
        type: NumberConstructor;
        default: number;
    };
    height: {
        type: NumberConstructor;
        default: number;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | null>;
        default: null;
    };
    width: {
        type: NumberConstructor;
        default: number;
    };
    height: {
        type: NumberConstructor;
        default: number;
    };
}>> & Readonly<{}>, {
    width: number;
    height: number;
    engine: CanvasEngine | null;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
