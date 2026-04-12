import { BoardSnapshot, CanvasPlugin } from '@canvas/core';

interface HistoryState {
    undoDepth: number;
    redoDepth: number;
    current: string | null;
}
interface HistoryEntry {
    label: string;
    snapshot: BoardSnapshot;
    timestamp: number;
}
interface HistoryPluginOptions {
    maxSteps?: number;
    debounceMs?: number;
    exclude?: string[];
}
declare module '@canvas/core' {
    interface CanvasEventMap {
        'history:push': (entry: HistoryEntry) => void;
        'history:undo': (entry: HistoryEntry | null) => void;
        'history:redo': (entry: HistoryEntry | null) => void;
        'history:clear': () => void;
    }
    interface CanvasEngine {
        undo?: () => void;
        redo?: () => void;
        canUndo?: () => boolean;
        canRedo?: () => boolean;
        clearHistory?: () => void;
        getHistoryState?: () => HistoryState;
    }
}
declare function historyPlugin(options?: HistoryPluginOptions): CanvasPlugin;

export { type HistoryEntry, type HistoryPluginOptions, type HistoryState, historyPlugin };
