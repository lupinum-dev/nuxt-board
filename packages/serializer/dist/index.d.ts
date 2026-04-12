import { BoardSnapshot, CanvasNode, CanvasEngine } from '@canvas/core';

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
    'x-canvas'?: {
        camera?: BoardSnapshot['camera'];
        grid?: BoardSnapshot['grid'];
        nextZIndex?: number;
        nodes?: Record<string, {
            zIndex?: number;
            locked?: boolean;
            visible?: boolean;
        }>;
        edges?: Array<Record<string, unknown>>;
    };
}
type TypeHandler = {
    serialize?: (node: CanvasNode) => Record<string, unknown>;
    deserialize?: (raw: Record<string, unknown>) => Record<string, unknown>;
};
interface JsonCanvasSerializer {
    registerType(type: string, handler: TypeHandler): void;
    export(input: BoardSnapshot | CanvasEngine, extras?: {
        edges?: Array<Record<string, unknown>>;
    }): string;
    parse(json: string): JsonCanvasDocument;
    toSnapshot(document: JsonCanvasDocument): BoardSnapshot;
}
declare function createJsonCanvasSerializer(): JsonCanvasSerializer;
/** Default serializer instance for convenience. */
declare const jsonCanvasSerializer: JsonCanvasSerializer;

export { type JsonCanvasDocument, type JsonCanvasNode, type JsonCanvasSerializer, type TypeHandler, createJsonCanvasSerializer, jsonCanvasSerializer };
