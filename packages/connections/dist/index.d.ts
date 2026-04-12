import { type PropType } from 'vue';
import { type Bounds, type CanvasEngine, type CanvasPlugin, type CanvasNode, type EdgeId, type NodeId, type Point } from '@canvas/core';
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';
export type ConnectionRouting = 'bezier' | 'step' | 'straight';
export interface AnchorPosition {
    side: AnchorSide;
    offset: number;
}
export interface CanvasEdge<T = Record<string, unknown>> {
    id: EdgeId;
    from: NodeId;
    to: NodeId;
    fromAnchor?: AnchorPosition;
    toAnchor?: AnchorPosition;
    data: T;
    zIndex: number;
}
export interface ConnectionPluginOptions {
    routing?: ConnectionRouting;
    defaultArrow?: 'none' | 'start' | 'end' | 'both';
    snapDistance?: number;
}
declare module '@canvas/core' {
    interface CanvasEventMap {
        'edge:created': (edge: CanvasEdge) => void;
        'edge:deleted': (edgeId: EdgeId) => void;
    }
    interface CanvasEngine {
        createEdge?: <T extends Record<string, unknown> = Record<string, unknown>>(input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & {
            id?: EdgeId;
            zIndex?: number;
        }) => CanvasEdge<T>;
        deleteEdge?: (id: EdgeId) => void;
        getEdges?: () => CanvasEdge[];
        getEdgesFrom?: (id: NodeId) => CanvasEdge[];
        getEdgesTo?: (id: NodeId) => CanvasEdge[];
        getEdgesBetween?: (from: NodeId, to: NodeId) => CanvasEdge[];
    }
}
type ExtendedEngine = CanvasEngine & {
    createEdge: <T extends Record<string, unknown> = Record<string, unknown>>(input: Omit<CanvasEdge<T>, 'id' | 'zIndex'> & {
        id?: EdgeId;
        zIndex?: number;
    }) => CanvasEdge<T>;
    deleteEdge: (id: EdgeId) => void;
    getEdges: () => CanvasEdge[];
    getEdgesFrom: (id: NodeId) => CanvasEdge[];
    getEdgesTo: (id: NodeId) => CanvasEdge[];
    getEdgesBetween: (from: NodeId, to: NodeId) => CanvasEdge[];
};
export declare function connectionPlugin(options?: ConnectionPluginOptions): CanvasPlugin;
export declare function resolveAnchorPoint(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, anchor?: AnchorPosition): Point;
export declare function routeEdgePath(from: Point, to: Point, routing?: ConnectionRouting): string;
export declare function getEdgeBounds(from: Point, to: Point): Bounds;
export declare function getVisibleEdges(engine: ExtendedEngine, bounds: Bounds): CanvasEdge[];
export declare const CanvasConnectionLayer: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<ExtendedEngine | null>;
        default: null;
    };
    routing: {
        type: PropType<ConnectionRouting>;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<ExtendedEngine | null>;
        default: null;
    };
    routing: {
        type: PropType<ConnectionRouting>;
        default: string;
    };
}>> & Readonly<{}>, {
    engine: ExtendedEngine | null;
    routing: ConnectionRouting;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export {};
