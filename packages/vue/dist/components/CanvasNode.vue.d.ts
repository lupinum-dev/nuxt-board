import type { CanvasNode, ResizeHandle } from '@canvas/core';
type __VLS_Props = {
    node: CanvasNode;
    selected: boolean;
    editing: boolean;
    /** Pass true when a real custom renderer or slot is provided by the parent. */
    customRenderer?: boolean;
};
declare var __VLS_1: {
    node: CanvasNode<Record<string, unknown>>;
    selected: boolean;
    editing: boolean;
    beginEdit: () => void;
    commitText: (text: string) => CanvasNode<Record<string, unknown>>;
}, __VLS_3: {
    key: ResizeHandle;
    node: CanvasNode<Record<string, unknown>>;
    handle: ResizeHandle;
};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
} & {
    handle?: (props: typeof __VLS_3) => any;
};
declare const __VLS_component: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: __VLS_WithSlots<typeof __VLS_component, __VLS_Slots>;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
