import { type PropType } from 'vue';
import { type CanvasGridSettings, type CanvasEngine, type CanvasEngineSnapshot, type ResizeHandle } from '@canvas/core';
import { type CanvasGridOptions } from '../grid';
declare var __VLS_4: {
    engine: CanvasEngine;
    snapshot: CanvasEngineSnapshot;
    debugState: {
        camera: import("@canvas/core").Camera;
        grid: CanvasGridSettings;
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
                grid: {
                    size: number;
                    majorEvery: number;
                    snap: boolean;
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
                    startScreenPoint: {
                        x: number;
                        y: number;
                    };
                    startNodePosition: {
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
                startScreenPoint: {
                    x: number;
                    y: number;
                };
                startNodePosition: {
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
declare const __VLS_component: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | undefined>;
        default: undefined;
    };
    debug: {
        type: BooleanConstructor;
        default: boolean;
    };
    cullMargin: {
        type: NumberConstructor;
        default: number;
    };
    grid: {
        type: PropType<boolean | CanvasGridOptions>;
        default: boolean;
    };
}>, {
    engine: CanvasEngine;
    debugState: import("vue").ComputedRef<{
        camera: import("@canvas/core").Camera;
        grid: CanvasGridSettings;
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
                grid: {
                    size: number;
                    majorEvery: number;
                    snap: boolean;
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
                    startScreenPoint: {
                        x: number;
                        y: number;
                    };
                    startNodePosition: {
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
                startScreenPoint: {
                    x: number;
                    y: number;
                };
                startNodePosition: {
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
}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | undefined>;
        default: undefined;
    };
    debug: {
        type: BooleanConstructor;
        default: boolean;
    };
    cullMargin: {
        type: NumberConstructor;
        default: number;
    };
    grid: {
        type: PropType<boolean | CanvasGridOptions>;
        default: boolean;
    };
}>> & Readonly<{
    onReady?: ((engine: CanvasEngine) => any) | undefined;
}>, {
    engine: CanvasEngine | undefined;
    cullMargin: number;
    debug: boolean;
    grid: boolean | CanvasGridOptions;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
