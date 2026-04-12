import type { Camera, Point, VisibleBounds } from './types';
export declare function clamp(value: number, min: number, max: number): number;
export declare function screenToWorld(screenPoint: Point, camera: Camera): Point;
export declare function worldToScreen(worldPoint: Point, camera: Camera): Point;
export declare function getVisibleBounds(viewportWidth: number, viewportHeight: number, camera: Camera): VisibleBounds;
export declare function zoomCameraAtScreenPoint(screenPoint: Point, delta: number, camera: Camera, minZoom: number, maxZoom: number): Camera;
