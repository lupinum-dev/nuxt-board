import { type CanvasEngine, type CanvasEngineSnapshot, type ResizeHandle } from '@canvas/core';
type __VLS_Props = {
    engine?: CanvasEngine;
    debug?: boolean;
    cullMargin?: number;
};
declare var __VLS_4: {
    engine: CanvasEngine;
    snapshot: CanvasEngineSnapshot;
    debugState: {
        camera: import("@canvas/core").Camera;
        selection: string[];
        interaction: import("@canvas/core").InteractionState;
        visibleNodeCount: number;
        renderCount: number;
        lastPerformanceSample: {
            command: string;
            durationMs: number;
            timestamp: number;
        } | null;
        lastInvariantFailure: string | null;
        recentEvents: ({
            type: "command:start";
            command: string;
            timestamp: number;
            payload?: Record<string, unknown> | undefined;
        } | {
            type: "command:end";
            command: string;
            timestamp: number;
            payload?: Record<string, unknown> | undefined;
        } | {
            type: "state:changed";
            command: string;
            timestamp: number;
            snapshot: {
                camera: {
                    x: number;
                    y: number;
                    z: number;
                };
                nodes: {
                    id: import("@canvas/core").NodeId;
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    text: string;
                    zIndex: number;
                }[];
                selection: import("@canvas/core").NodeId[];
                interaction: {
                    mode: "idle";
                } | {
                    mode: "panning";
                    pointerId: number;
                    lastScreenPoint: {
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "dragging-node";
                    pointerId: number;
                    nodeId: import("@canvas/core").NodeId;
                    lastScreenPoint: {
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "resizing-node";
                    pointerId: number;
                    nodeId: import("@canvas/core").NodeId;
                    handle: ResizeHandle;
                    startScreenPoint: {
                        x: number;
                        y: number;
                    };
                    startNodeBounds: {
                        width: number;
                        height: number;
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "editing-text";
                    nodeId: import("@canvas/core").NodeId;
                };
                nextZIndex: number;
            };
        } | {
            type: "interaction:changed";
            timestamp: number;
            interaction: {
                mode: "idle";
            } | {
                mode: "panning";
                pointerId: number;
                lastScreenPoint: {
                    x: number;
                    y: number;
                };
            } | {
                mode: "dragging-node";
                pointerId: number;
                nodeId: import("@canvas/core").NodeId;
                lastScreenPoint: {
                    x: number;
                    y: number;
                };
            } | {
                mode: "resizing-node";
                pointerId: number;
                nodeId: import("@canvas/core").NodeId;
                handle: ResizeHandle;
                startScreenPoint: {
                    x: number;
                    y: number;
                };
                startNodeBounds: {
                    width: number;
                    height: number;
                    x: number;
                    y: number;
                };
            } | {
                mode: "editing-text";
                nodeId: import("@canvas/core").NodeId;
            };
        } | {
            type: "invariant:failed";
            timestamp: number;
            failure: import("@canvas/core").InvariantFailure;
        } | {
            type: "performance:sample";
            timestamp: number;
            sample: {
                command: string;
                durationMs: number;
                timestamp: number;
            };
        })[];
    };
};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_4) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {
    engine: CanvasEngine;
    debugState: import("vue").ComputedRef<{
        camera: import("@canvas/core").Camera;
        selection: string[];
        interaction: import("@canvas/core").InteractionState;
        visibleNodeCount: number;
        renderCount: number;
        lastPerformanceSample: {
            command: string;
            durationMs: number;
            timestamp: number;
        } | null;
        lastInvariantFailure: string | null;
        recentEvents: ({
            type: "command:start";
            command: string;
            timestamp: number;
            payload?: Record<string, unknown> | undefined;
        } | {
            type: "command:end";
            command: string;
            timestamp: number;
            payload?: Record<string, unknown> | undefined;
        } | {
            type: "state:changed";
            command: string;
            timestamp: number;
            snapshot: {
                camera: {
                    x: number;
                    y: number;
                    z: number;
                };
                nodes: {
                    id: import("@canvas/core").NodeId;
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    text: string;
                    zIndex: number;
                }[];
                selection: import("@canvas/core").NodeId[];
                interaction: {
                    mode: "idle";
                } | {
                    mode: "panning";
                    pointerId: number;
                    lastScreenPoint: {
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "dragging-node";
                    pointerId: number;
                    nodeId: import("@canvas/core").NodeId;
                    lastScreenPoint: {
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "resizing-node";
                    pointerId: number;
                    nodeId: import("@canvas/core").NodeId;
                    handle: ResizeHandle;
                    startScreenPoint: {
                        x: number;
                        y: number;
                    };
                    startNodeBounds: {
                        width: number;
                        height: number;
                        x: number;
                        y: number;
                    };
                } | {
                    mode: "editing-text";
                    nodeId: import("@canvas/core").NodeId;
                };
                nextZIndex: number;
            };
        } | {
            type: "interaction:changed";
            timestamp: number;
            interaction: {
                mode: "idle";
            } | {
                mode: "panning";
                pointerId: number;
                lastScreenPoint: {
                    x: number;
                    y: number;
                };
            } | {
                mode: "dragging-node";
                pointerId: number;
                nodeId: import("@canvas/core").NodeId;
                lastScreenPoint: {
                    x: number;
                    y: number;
                };
            } | {
                mode: "resizing-node";
                pointerId: number;
                nodeId: import("@canvas/core").NodeId;
                handle: ResizeHandle;
                startScreenPoint: {
                    x: number;
                    y: number;
                };
                startNodeBounds: {
                    width: number;
                    height: number;
                    x: number;
                    y: number;
                };
            } | {
                mode: "editing-text";
                nodeId: import("@canvas/core").NodeId;
            };
        } | {
            type: "invariant:failed";
            timestamp: number;
            failure: import("@canvas/core").InvariantFailure;
        } | {
            type: "performance:sample";
            timestamp: number;
            sample: {
                command: string;
                durationMs: number;
                timestamp: number;
            };
        })[];
    }>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    ready: (engine: CanvasEngine) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onReady?: ((engine: CanvasEngine) => any) | undefined;
}>, {
    engine: CanvasEngine;
    cullMargin: number;
    debug: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
