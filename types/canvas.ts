import type { Edge, Node } from "@xyflow/react";

export const NODE_COLORS = [
	{ fill: "#1F1F1F", text: "#EDEDED", name: "neutral" },
	{ fill: "#10233D", text: "#52A8FF", name: "blue" },
	{ fill: "#2E1938", text: "#BF7AF0", name: "purple" },
	{ fill: "#331B00", text: "#FF990A", name: "orange" },
	{ fill: "#3C1618", text: "#FF6166", name: "red" },
	{ fill: "#3A1726", text: "#F75F8F", name: "pink" },
	{ fill: "#0F2E18", text: "#62C073", name: "green" },
	{ fill: "#062822", text: "#0AC7B4", name: "teal" },
] as const;

export const DEFAULT_NODE_COLOR = NODE_COLORS[0].fill;
export const DEFAULT_TEXT_COLOR = NODE_COLORS[0].text;
export const SHAPE_DRAG_MIME_TYPE = "application/x-flow-ai-shape";
export const EMPTY_NODE_LABEL_PLACEHOLDER = "Untitled";

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
	textColor: string;
	shape: NodeShape;
}

export interface CanvasEdgeData extends Record<string, unknown> {
	label?: string;
}

export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge<CanvasEdgeData, CanvasEdgeType>;

export interface CanvasSnapshot {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	version: 1;
	savedAt: string;
}

export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error";

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

export const SHAPE_MIN_SIZES: Record<NodeShape, ShapeSize> = {
	rectangle: { width: 120, height: 64 },
	diamond: { width: 112, height: 112 },
	circle: { width: 96, height: 96 },
	pill: { width: 132, height: 56 },
	cylinder: { width: 120, height: 80 },
	hexagon: { width: 124, height: 72 },
};

export function isNodeShape(value: unknown): value is NodeShape {
	return (
		typeof value === "string" &&
		(NODE_SHAPES as readonly string[]).includes(value)
	);
}
