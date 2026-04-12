import { CanvasNode, BoardSnapshot } from '@canvas/core';

interface JsonCanvasNode {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    [key: string]: unknown;
}
interface JsonCanvasDocument {
    nodes: JsonCanvasNode[];
    edges?: Array<Record<string, unknown>>;
}
type TypeHandler = {
    serialize?: (node: CanvasNode) => Record<string, unknown>;
    deserialize?: (raw: Record<string, unknown>) => Record<string, unknown>;
};
declare const jsonCanvasSerializer: {
    registerType(type: string, handler: TypeHandler): void;
    export(snapshot: BoardSnapshot, extras?: {
        edges?: Array<Record<string, unknown>>;
    }): string;
    parse(json: string): JsonCanvasDocument;
    toSnapshot(document: JsonCanvasDocument): BoardSnapshot;
};

export { type JsonCanvasDocument, type JsonCanvasNode, jsonCanvasSerializer };
