import type { BoardState, CanvasEngineSnapshot, CanvasGridSettings, InvariantFailure } from './types';
export declare function createInvariantSnapshot(state: BoardState, grid?: CanvasGridSettings): CanvasEngineSnapshot;
export declare function validateState(state: BoardState, context: string, grid?: CanvasGridSettings): InvariantFailure[];
