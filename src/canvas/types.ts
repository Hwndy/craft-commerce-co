export type Camera = { x: number; y: number; zoom: number };

export type Viewpoint = Camera & {
  key: string;
  label: string;
  sortOrder: number;
  inGuidedPath?: boolean;
};

export type NodeType =
  | "image"
  | "video"
  | "text"
  | "product"
  | "button"
  | "link"
  | "region-label";

export interface CanvasNode {
  id: string;
  region: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: number;
  zoomMin: number;
  zoomMax: number;
  ref?: { table: string; id: string };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}
