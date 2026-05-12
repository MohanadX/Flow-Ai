"use client";

import {
	type DragEvent,
	type ComponentType,
	type PointerEvent,
	useMemo,
	useRef,
} from "react";
import {
	ClientSideSuspense,
	LiveblocksProvider,
	RoomProvider,
	useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { Cursors, useLiveblocksFlow } from "@liveblocks/react-flow";
import {
	Background,
	BackgroundVariant,
	type NodeChange,
	ConnectionMode,
	Handle,
	MiniMap,
	type NodeProps,
	type NodeTypes,
	Position,
	ReactFlow,
	type ReactFlowInstance,
	useReactFlow,
} from "@xyflow/react";
import {
	Circle,
	Database,
	Diamond,
	Hexagon,
	Square,
	StretchHorizontal,
} from "lucide-react";

import { CanvasErrorBoundary } from "@/components/editor/canvas-error-boundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	CANVAS_NODE_TYPE,
	DEFAULT_NODE_COLOR,
	SHAPE_DEFAULT_SIZES,
	SHAPE_DRAG_MIME_TYPE,
	isNodeShape,
	type CanvasEdge,
	type CanvasNode,
	type NodeShape,
	type ShapeDragPayload,
} from "@/types/canvas";

interface CollaborativeCanvasProps {
	roomId: string;
}

interface ShapeTool {
	shape: NodeShape;
	label: string;
	Icon: ComponentType<{ className?: string }>;
}

const SHAPE_TOOLS: ShapeTool[] = [
	{ shape: "rectangle", label: "Rectangle", Icon: Square },
	{ shape: "diamond", label: "Diamond", Icon: Diamond },
	{ shape: "circle", label: "Circle", Icon: Circle },
	{ shape: "pill", label: "Pill", Icon: StretchHorizontal },
	{ shape: "cylinder", label: "Cylinder", Icon: Database },
	{ shape: "hexagon", label: "Hexagon", Icon: Hexagon },
];

export function CollaborativeCanvas({ roomId }: CollaborativeCanvasProps) {
	return (
		<LiveblocksProvider authEndpoint="/api/liveblocks-auth">
			<CanvasErrorBoundary fallback={<CanvasErrorState />}>
				<RoomProvider
					id={roomId}
					initialPresence={{ cursor: null, isThinking: false }}
				>
					<ClientSideSuspense fallback={<CanvasLoadingState />}>
						<BaseCanvas />
					</ClientSideSuspense>
				</RoomProvider>
			</CanvasErrorBoundary>
		</LiveblocksProvider>
	);
}

function BaseCanvas() {
	const reactFlowInstanceRef = useRef<ReactFlowInstance<
		CanvasNode,
		CanvasEdge
	> | null>(null);
	const nodeCounterRef = useRef(0);
	const nodeTypes = useMemo(
		() =>
			({
				[CANVAS_NODE_TYPE]: CanvasNodeRenderer,
			}) satisfies NodeTypes,
		[],
	);
	const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
		useLiveblocksFlow<CanvasNode, CanvasEdge>({
			suspense: true,
			nodes: {
				initial: [],
			},
			edges: {
				initial: [],
			},
		});

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		if (event.dataTransfer.types.includes(SHAPE_DRAG_MIME_TYPE)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();

		const payload = readShapeDragPayload(event);
		const reactFlowInstance = reactFlowInstanceRef.current;

		if (!payload || !reactFlowInstance) return;

		nodeCounterRef.current += 1;

		const position = reactFlowInstance.screenToFlowPosition({
			x: event.clientX,
			y: event.clientY,
		});
		const node: CanvasNode = {
			id: `${payload.shape}-${Date.now()}-${nodeCounterRef.current}`,
			type: CANVAS_NODE_TYPE,
			position: {
				x: position.x,
				y: position.y,
			},
			width: payload.width,
			height: payload.height,
			style: {
				width: payload.width,
				height: payload.height,
			},
			data: {
				label: "",
				color: DEFAULT_NODE_COLOR,
				shape: payload.shape,
			},
		};
		const changes: NodeChange<CanvasNode>[] = [{ type: "add", item: node }];

		onNodesChange(changes);
	}

	return (
		<div
			className="relative h-full w-full bg-base"
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<ReactFlow<CanvasNode, CanvasEdge>
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				onDelete={onDelete}
				onInit={(instance) => {
					reactFlowInstanceRef.current = instance;
				}}
				connectionMode={ConnectionMode.Loose}
				fitView
			>
				<Cursors />
				<MiniMap />
				<Background variant={BackgroundVariant.Dots} />
				<ShapePanel />
			</ReactFlow>
		</div>
	);
}

function ShapePanel() {
	const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
	const updateMyPresence = useUpdateMyPresence();

	function handlePointerPresence(event: PointerEvent<HTMLDivElement>) {
		updateMyPresence({
			cursor: reactFlow.screenToFlowPosition({
				x: event.clientX,
				y: event.clientY,
			}),
		});
	}

	return (
		<div
			className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
			onPointerEnter={handlePointerPresence}
			onPointerMove={handlePointerPresence}
		>
			{SHAPE_TOOLS.map(({ shape, label, Icon }) => (
				<Button
					key={shape}
					type="button"
					variant="ghost"
					size="icon"
					className="size-9 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary"
					draggable
					aria-label={`Drag ${label}`}
					title={label}
					onDragStart={(event) => startShapeDrag(event, shape)}
				>
					<Icon className="h-4 w-4" />
				</Button>
			))}
		</div>
	);
}

function CanvasNodeRenderer({ data, selected }: NodeProps<CanvasNode>) {
	return (
		<div
			className={cn(
				"flex h-full min-h-12 w-full min-w-24 items-center justify-center rounded-xl border px-4 py-2 text-center text-sm font-medium text-copy-primary shadow-lg",
				selected
					? "border-brand shadow-[0_0_20px_var(--color-brand-dim)]"
					: "border-surface-border-subtle",
			)}
			style={{ backgroundColor: data.color }}
		>
			<Handle type="target" position={Position.Top} />
			<Handle type="source" position={Position.Right} />
			<Handle type="source" position={Position.Bottom} />
			<Handle type="target" position={Position.Left} />
			<span className="truncate">{data.label}</span>
		</div>
	);
}

function startShapeDrag(event: DragEvent<HTMLButtonElement>, shape: NodeShape) {
	const size = SHAPE_DEFAULT_SIZES[shape];
	const payload: ShapeDragPayload = {
		shape,
		width: size.width,
		height: size.height,
	};

	event.dataTransfer.effectAllowed = "copy";
	event.dataTransfer.setData(SHAPE_DRAG_MIME_TYPE, JSON.stringify(payload));
	event.dataTransfer.setData("text/plain", shape);
}

function readShapeDragPayload(
	event: DragEvent<HTMLDivElement>,
): ShapeDragPayload | null {
	const rawPayload = event.dataTransfer.getData(SHAPE_DRAG_MIME_TYPE);

	if (!rawPayload) return null;

	let parsed: unknown;

	try {
		parsed = JSON.parse(rawPayload);
	} catch {
		return null;
	}

	if (!isShapeDragPayload(parsed)) {
		return null;
	}

	return parsed;
}

function isShapeDragPayload(value: unknown): value is ShapeDragPayload {
	if (typeof value !== "object" || value === null) return false;

	const candidate = value as Record<string, unknown>;

	return (
		isNodeShape(candidate.shape) &&
		isPositiveNumber(candidate.width) &&
		isPositiveNumber(candidate.height)
	);
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function CanvasLoadingState() {
	return (
		<div className="flex h-full w-full items-center justify-center bg-base text-sm text-copy-muted">
			Loading canvas...
		</div>
	);
}

function CanvasErrorState() {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center bg-base px-6 text-center">
			<h2 className="text-lg font-semibold text-copy-primary">
				Canvas connection failed
			</h2>
			<p className="mt-2 max-w-sm text-sm text-copy-muted">
				We could not connect to the collaborative room. Refresh the workspace
				and try again.
			</p>
		</div>
	);
}
