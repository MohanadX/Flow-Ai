import type { Edge, Node } from "@xyflow/react";

export const DEFAULT_NODE_COLOR = "#1F1F1F";
export const SHAPE_DRAG_MIME_TYPE = "application/x-flow-ai-shape";

export const NODE_SHAPES = [
	"rectangle",
	"diamond",
	"circle",
	"pill",
	"cylinder",
	"hexagon",
] as const;

export const CANVAS_NODE_TYPE = "canvasNode";
export const CANVAS_EDGE_TYPE = "canvasEdge";

export type NodeShape = (typeof NODE_SHAPES)[number];
export type CanvasNodeType = typeof CANVAS_NODE_TYPE;
export type CanvasEdgeType = typeof CANVAS_EDGE_TYPE;

export interface CanvasNodeData extends Record<string, unknown> {
	label: string;
	color: string;
	shape: NodeShape;
}

export type CanvasEdgeData = Record<string, never>;

export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge<CanvasEdgeData, CanvasEdgeType>;

export interface ShapeSize {
	width: number;
	height: number;
}

export interface ShapeDragPayload extends ShapeSize {
	shape: NodeShape;
}

export const SHAPE_DEFAULT_SIZES: Record<NodeShape, ShapeSize> = {
	rectangle: { width: 180, height: 88 },
	diamond: { width: 144, height: 144 },
	circle: { width: 112, height: 112 },
	pill: { width: 168, height: 72 },
	cylinder: { width: 152, height: 104 },
	hexagon: { width: 156, height: 96 },
};

export function isNodeShape(value: unknown): value is NodeShape {
	return (
		typeof value === "string" &&
		(NODE_SHAPES as readonly string[]).includes(value)
	);
}
