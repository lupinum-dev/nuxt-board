import type { BoardState, CanvasEngineSnapshot, InvariantFailure } from './types';
export declare function createInvariantSnapshot(state: BoardState): CanvasEngineSnapshot;
export declare function validateState(state: BoardState, context: string): InvariantFailure[];
