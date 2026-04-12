import type { BoardSnapshot, BoardState, GridSettings, InvariantFailure, InteractionState } from './types';
export declare function cloneInteraction(interaction: InteractionState): InteractionState;
export declare function createSnapshot(state: BoardState, grid: GridSettings): BoardSnapshot;
export declare function validateState(state: BoardState, grid: GridSettings, context: string): InvariantFailure[];
