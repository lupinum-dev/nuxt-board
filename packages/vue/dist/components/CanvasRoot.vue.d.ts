import { type Component, type PropType } from 'vue';
import type { BoardSnapshot, CanvasEngine, CanvasNode as CanvasNodeState, GridSettings, ResizeHandle } from '@canvas/core';
import { type CanvasGridOptions, type CanvasRendererRegistry } from '../grid';
declare var __VLS_7: {
    engine: CanvasEngine;
    snapshot: BoardSnapshot;
}, __VLS_13: `node:${string}`, __VLS_14: {
    node: CanvasNodeState<Record<string, unknown>>;
    selected: boolean;
    editing: boolean;
    beginEdit: () => void;
    commitText: (text: string) => CanvasNodeState<Record<string, unknown>>;
}, __VLS_16: {
    node: CanvasNodeState<Record<string, unknown>>;
    selected: boolean;
    editing: boolean;
    beginEdit: () => void;
    commitText: (text: string) => CanvasNodeState<Record<string, unknown>>;
}, __VLS_22: {
    key: ResizeHandle;
    node: CanvasNodeState<Record<string, unknown>>;
    handle: ResizeHandle;
}, __VLS_27: {
    bounds: import("@canvas/core").Bounds;
}, __VLS_29: {
    engine: CanvasEngine;
    snapshot: BoardSnapshot;
    debugState: {
        snapshot: BoardSnapshot;
        camera: import("@canvas/core").Camera;
        grid: GridSettings;
        selection: string[];
        interaction: import("@canvas/core").InteractionState;
        visibleNodeCount: number;
        renderCount: number;
        trace: import("@canvas/core").TraceEntry[];
    };
};
type __VLS_Slots = {} & {
    [K in NonNullable<typeof __VLS_13>]?: (props: typeof __VLS_14) => any;
} & {
    viewport?: (props: typeof __VLS_7) => any;
} & {
    node?: (props: typeof __VLS_16) => any;
} & {
    handle?: (props: typeof __VLS_22) => any;
} & {
    'box-select'?: (props: typeof __VLS_27) => any;
} & {
    default?: (props: typeof __VLS_29) => any;
};
declare const __VLS_component: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | undefined>;
        default: undefined;
    };
    cullMargin: {
        type: NumberConstructor;
        default: number;
    };
    grid: {
        type: PropType<boolean | CanvasGridOptions>;
        default: boolean;
    };
    renderers: {
        type: PropType<CanvasRendererRegistry>;
        default: () => {};
    };
    fallbackRenderer: {
        type: PropType<Component | null>;
        default: null;
    };
}>, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    ready: (engine: CanvasEngine) => any;
}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    engine: {
        type: PropType<CanvasEngine | undefined>;
        default: undefined;
    };
    cullMargin: {
        type: NumberConstructor;
        default: number;
    };
    grid: {
        type: PropType<boolean | CanvasGridOptions>;
        default: boolean;
    };
    renderers: {
        type: PropType<CanvasRendererRegistry>;
        default: () => {};
    };
    fallbackRenderer: {
        type: PropType<Component | null>;
        default: null;
    };
}>> & Readonly<{
    onReady?: ((engine: CanvasEngine) => any) | undefined;
}>, {
    engine: CanvasEngine | undefined;
    cullMargin: number;
    grid: boolean | CanvasGridOptions;
    renderers: CanvasRendererRegistry;
    fallbackRenderer: Component | null;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
