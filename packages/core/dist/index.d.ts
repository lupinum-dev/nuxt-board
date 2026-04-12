type NodeId = string;
interface Point {
    x: number;
    y: number;
}
interface Camera {
    x: number;
    y: number;
    z: number;
}
interface CanvasNode {
    id: NodeId;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    zIndex: number;
}
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type InteractionMode = 'idle' | 'panning' | 'dragging-node' | 'resizing-node' | 'editing-text';
interface VisibleBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
interface IdleInteractionState {
    mode: 'idle';
}
interface PanInteractionState {
    mode: 'panning';
    pointerId: number;
    lastScreenPoint: Point;
}
interface DragInteractionState {
    mode: 'dragging-node';
    pointerId: number;
    nodeId: NodeId;
    lastScreenPoint: Point;
}
interface ResizeInteractionState {
    mode: 'resizing-node';
    pointerId: number;
    nodeId: NodeId;
    handle: ResizeHandle;
    startScreenPoint: Point;
    startNodeBounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
}
interface EditingInteractionState {
    mode: 'editing-text';
    nodeId: NodeId;
}
type InteractionState = IdleInteractionState | PanInteractionState | DragInteractionState | ResizeInteractionState | EditingInteractionState;
interface BoardState {
    camera: Camera;
    nodes: Map<NodeId, CanvasNode>;
    selection: Set<NodeId>;
    interaction: InteractionState;
    nextZIndex: number;
}
interface CanvasEngineSnapshot {
    camera: Camera;
    nodes: CanvasNode[];
    selection: NodeId[];
    interaction: InteractionState;
    nextZIndex: number;
}
interface CanvasEngineOptions {
    minZoom?: number;
    maxZoom?: number;
    minNodeWidth?: number;
    minNodeHeight?: number;
    defaultNodeWidth?: number;
    defaultNodeHeight?: number;
    traceLimit?: number;
    diagnostics?: boolean;
    strictInvariants?: boolean;
    initialCamera?: Partial<Camera>;
    initialNodes?: CanvasNode[];
    onInvariantFailure?: (error: InvariantFailure) => void;
}
interface InvariantFailure {
    name: string;
    message: string;
    snapshot: CanvasEngineSnapshot;
    context: string;
}
interface CanvasCommandPerformanceSample {
    command: string;
    durationMs: number;
    timestamp: number;
}
type CanvasDiagnosticsEvent = {
    type: 'command:start';
    command: string;
    timestamp: number;
    payload?: Record<string, unknown>;
} | {
    type: 'command:end';
    command: string;
    timestamp: number;
    payload?: Record<string, unknown>;
} | {
    type: 'state:changed';
    command: string;
    timestamp: number;
    snapshot: CanvasEngineSnapshot;
} | {
    type: 'interaction:changed';
    timestamp: number;
    interaction: InteractionState;
} | {
    type: 'invariant:failed';
    timestamp: number;
    failure: InvariantFailure;
} | {
    type: 'performance:sample';
    timestamp: number;
    sample: CanvasCommandPerformanceSample;
};
interface CanvasEngine {
    getState(): Readonly<BoardState>;
    getSnapshot(): CanvasEngineSnapshot;
    subscribe(listener: (event: CanvasDiagnosticsEvent) => void): () => void;
    exportTrace(): CanvasDiagnosticsEvent[];
    screenToWorld(screenPoint: Point): Point;
    worldToScreen(worldPoint: Point): Point;
    getVisibleBounds(viewportWidth: number, viewportHeight: number): VisibleBounds;
    panByScreenDelta(deltaX: number, deltaY: number): void;
    zoomAtScreenPoint(screenPoint: Point, delta: number): void;
    createNode(input: Partial<Omit<CanvasNode, 'id' | 'zIndex'>> & {
        id?: NodeId;
    }): CanvasNode;
    updateNode(nodeId: NodeId, patch: Partial<Omit<CanvasNode, 'id' | 'zIndex'>>): CanvasNode;
    moveNode(nodeId: NodeId, deltaWorldX: number, deltaWorldY: number): CanvasNode;
    resizeNode(nodeId: NodeId, handle: ResizeHandle, deltaWorldX: number, deltaWorldY: number): CanvasNode;
    select(nodeIds: NodeId | NodeId[], mode?: 'replace' | 'append' | 'toggle'): void;
    clearSelection(): void;
    deleteSelected(): void;
    bringToFront(nodeId: NodeId): CanvasNode;
    beginTextEdit(nodeId: NodeId): void;
    commitTextEdit(nodeId: NodeId, text: string): CanvasNode;
    beginPan(pointerId: number, screenPoint: Point): void;
    beginNodeDrag(nodeId: NodeId, pointerId: number, screenPoint: Point): void;
    beginResize(nodeId: NodeId, handle: ResizeHandle, pointerId: number, screenPoint: Point): void;
    updatePointer(pointerId: number, screenPoint: Point): void;
    endInteraction(pointerId?: number): void;
}

declare function createCanvasEngine(options?: CanvasEngineOptions): CanvasEngine;

declare function clamp(value: number, min: number, max: number): number;
declare function screenToWorld(screenPoint: Point, camera: Camera): Point;
declare function worldToScreen(worldPoint: Point, camera: Camera): Point;
declare function getVisibleBounds(viewportWidth: number, viewportHeight: number, camera: Camera): VisibleBounds;
declare function zoomCameraAtScreenPoint(screenPoint: Point, delta: number, camera: Camera, minZoom: number, maxZoom: number): Camera;

interface ResizeConstraints {
    minWidth: number;
    minHeight: number;
}
declare function applyResizeDelta(node: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>, handle: ResizeHandle, deltaX: number, deltaY: number, constraints: ResizeConstraints): Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;

export { type BoardState, type Camera, type CanvasDiagnosticsEvent, type CanvasEngine, type CanvasEngineOptions, type CanvasEngineSnapshot, type CanvasNode, type InteractionMode, type InteractionState, type InvariantFailure, type NodeId, type Point, type ResizeHandle, type VisibleBounds, applyResizeDelta, clamp, createCanvasEngine, getVisibleBounds, screenToWorld, worldToScreen, zoomCameraAtScreenPoint };
