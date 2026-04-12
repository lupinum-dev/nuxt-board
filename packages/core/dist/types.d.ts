export type NodeId = string;
export interface Point {
    x: number;
    y: number;
}
export interface Camera {
    x: number;
    y: number;
    z: number;
}
export interface CanvasGridSettings {
    size: number;
    majorEvery: number;
    snap: boolean;
}
export interface CanvasNode {
    id: NodeId;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    zIndex: number;
}
export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type InteractionMode = 'idle' | 'panning' | 'dragging-node' | 'resizing-node' | 'editing-text';
export interface VisibleBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export interface IdleInteractionState {
    mode: 'idle';
}
export interface PanInteractionState {
    mode: 'panning';
    pointerId: number;
    lastScreenPoint: Point;
}
export interface DragInteractionState {
    mode: 'dragging-node';
    pointerId: number;
    nodeId: NodeId;
    startScreenPoint: Point;
    startNodePosition: Pick<CanvasNode, 'x' | 'y'>;
}
export interface ResizeInteractionState {
    mode: 'resizing-node';
    pointerId: number;
    nodeId: NodeId;
    handle: ResizeHandle;
    startScreenPoint: Point;
    startNodeBounds: Pick<CanvasNode, 'x' | 'y' | 'width' | 'height'>;
}
export interface EditingInteractionState {
    mode: 'editing-text';
    nodeId: NodeId;
}
export type InteractionState = IdleInteractionState | PanInteractionState | DragInteractionState | ResizeInteractionState | EditingInteractionState;
export interface BoardState {
    camera: Camera;
    nodes: Map<NodeId, CanvasNode>;
    selection: Set<NodeId>;
    interaction: InteractionState;
    nextZIndex: number;
}
export interface CanvasEngineSnapshot {
    camera: Camera;
    grid: CanvasGridSettings;
    nodes: CanvasNode[];
    selection: NodeId[];
    interaction: InteractionState;
    nextZIndex: number;
}
export interface CanvasEngineOptions {
    minZoom?: number;
    maxZoom?: number;
    minNodeWidth?: number;
    minNodeHeight?: number;
    defaultNodeWidth?: number;
    defaultNodeHeight?: number;
    gridSize?: number;
    majorGridEvery?: number;
    snapToGrid?: boolean;
    traceLimit?: number;
    diagnostics?: boolean;
    strictInvariants?: boolean;
    initialCamera?: Partial<Camera>;
    initialNodes?: CanvasNode[];
    onInvariantFailure?: (error: InvariantFailure) => void;
}
export interface InvariantFailure {
    name: string;
    message: string;
    snapshot: CanvasEngineSnapshot;
    context: string;
}
export interface CanvasCommandPerformanceSample {
    command: string;
    durationMs: number;
    timestamp: number;
}
export type CanvasDiagnosticsEvent = {
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
export interface CanvasEngine {
    getState(): Readonly<BoardState>;
    getSnapshot(): CanvasEngineSnapshot;
    getGridSettings(): CanvasGridSettings;
    updateGridSettings(patch: Partial<CanvasGridSettings>): CanvasGridSettings;
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
