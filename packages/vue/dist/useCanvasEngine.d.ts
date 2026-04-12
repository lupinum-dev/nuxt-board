export declare function useCanvasEngine(): import("./context").CanvasEngineContext;
export declare function useCamera(): import("vue").ComputedRef<import("@canvas/core").Camera>;
export declare function useNodes(): import("vue").ComputedRef<import("@canvas/core").CanvasNode<Record<string, unknown>>[]>;
export declare function useSelection(): import("vue").ComputedRef<string[]>;
export declare function useInteraction(): import("vue").ComputedRef<import("@canvas/core").InteractionState>;
export declare function useVisibleBounds(): import("vue").ComputedRef<import("@canvas/core").Bounds>;
export declare function useVisibleNodes(margin?: number): import("vue").ComputedRef<import("@canvas/core").CanvasNode<Record<string, unknown>>[]>;
export declare function useGridStyle(): import("vue").ComputedRef<{
    '--grid-minor-size': string;
    '--grid-major-size': string;
    '--grid-minor-x': string;
    '--grid-minor-y': string;
    '--grid-major-x': string;
    '--grid-major-y': string;
    '--grid-minor-color': string;
    '--grid-major-color': string;
    '--grid-mask-image': string;
}>;
export declare function useNode(id: string): {
    node: import("vue").ComputedRef<import("@canvas/core").CanvasNode<Record<string, unknown>>>;
    selected: import("vue").ComputedRef<boolean>;
    editing: import("vue").ComputedRef<boolean>;
    locked: import("vue").ComputedRef<boolean>;
    style: import("vue").ComputedRef<{
        left: string;
        top: string;
        width: string;
        height: string;
        zIndex: string;
    }>;
    beginEdit: () => void;
    commitText: (text: string) => import("@canvas/core").CanvasNode<Record<string, unknown>>;
    startDrag: (event: PointerEvent) => void;
    startResize: (handle: Parameters<(id: import("@canvas/core").NodeId, handle: import("@canvas/core").ResizeHandle, pointerId: number, screenPoint: import("@canvas/core").Point) => void>[1], event: PointerEvent) => void;
};
export declare function useBoxSelectBounds(): import("vue").ComputedRef<import("@canvas/core").Bounds | null>;
