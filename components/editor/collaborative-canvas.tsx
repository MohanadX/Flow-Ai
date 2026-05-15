"use client";

import {
	type ComponentType,
	type DragEvent,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Cursors, useLiveblocksFlow } from "@liveblocks/react-flow";
import {
	ClientSideSuspense,
	LiveblocksProvider,
	RoomProvider,
	useCanRedo,
	useCanUndo,
	useRedo,
	useUndo,
	useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import {
	Background,
	BackgroundVariant,
	type EdgeTypes,
	type NodeChange,
	ConnectionMode,
	Handle,
	NodeResizer,
	NodeToolbar,
	type NodeTypes,
	Position,
	ReactFlow,
	type ReactFlowInstance,
	useReactFlow,
	type NodeProps,
	EdgeChange,
} from "@xyflow/react";
import {
	Circle,
	Database,
	Diamond,
	Hexagon,
	Square,
	StretchHorizontal,
	Undo2,
	Redo2,
	Plus,
	Minus,
	Maximize,
} from "lucide-react";

import { CanvasEdgeRenderer } from "@/components/editor/canvas-edge";
import { CanvasErrorBoundary } from "@/components/editor/canvas-error-boundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	CANVAS_EDGE_TYPE,
	CANVAS_NODE_TYPE,
	DEFAULT_NODE_COLOR,
	DEFAULT_TEXT_COLOR,
	EMPTY_NODE_LABEL_PLACEHOLDER,
	NODE_COLORS,
	SHAPE_DEFAULT_SIZES,
	SHAPE_DRAG_MIME_TYPE,
	SHAPE_MIN_SIZES,
	isNodeShape,
	type CanvasEdge,
	type CanvasNode,
	type NodeShape,
	type ShapeDragPayload,
} from "@/types/canvas";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

interface CollaborativeCanvasProps {
	roomId: string;
}

interface ShapeTool {
	shape: NodeShape;
	label: string;
	Icon: ComponentType<{ className?: string }>;
}

interface ShapePanelProps {
	onShapeDragStart: (
		event: DragEvent<HTMLButtonElement>,
		shape: NodeShape,
	) => void;
	onShapeDragMove: (event: DragEvent<HTMLButtonElement>) => void;
	onShapeDragEnd: () => void;
}

type ShapeDragPreviewState = ShapeDragPayload & {
	x: number;
	y: number;
};

const NODE_RESIZER_HANDLE_CLASSNAME =
	"!h-3 !w-3 !rounded-full !border !border-surface-border-subtle !bg-elevated shadow-[0_0_0_1px_var(--color-base)]";

const NODE_RESIZER_LINE_CLASSNAME =
	"!border-surface-border-subtle/80 opacity-80";

const SHAPE_TOOLS: ShapeTool[] = [
	{ shape: "rectangle", label: "Rectangle", Icon: Square },
	{ shape: "diamond", label: "Diamond", Icon: Diamond },
	{ shape: "circle", label: "Circle", Icon: Circle },
	{ shape: "pill", label: "Pill", Icon: StretchHorizontal },
	{ shape: "cylinder", label: "Cylinder", Icon: Database },
	{ shape: "hexagon", label: "Hexagon", Icon: Hexagon },
];

import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal";
import type { CanvasTemplate } from "@/components/editor/starter-templates";

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
	const [dragPreview, setDragPreview] = useState<ShapeDragPreviewState | null>(
		null,
	);
	const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

	const nodeTypes = useMemo(
		() =>
			({
				[CANVAS_NODE_TYPE]: CanvasNodeRenderer,
			}) satisfies NodeTypes,
		[],
	);
	const edgeTypes = useMemo(
		() =>
			({
				[CANVAS_EDGE_TYPE]: CanvasEdgeRenderer,
			}) satisfies EdgeTypes,
		[],
	);
	const defaultEdgeOptions = useMemo(
		() => ({
			type: CANVAS_EDGE_TYPE,
			markerEnd: {
				type: "arrowclosed" as const,
				width: 14,
				height: 14,
				color: "var(--color-copy-faint)",
			},
			style: {
				strokeLinecap: "round" as const,
			},
		}),
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

	useEffect(() => {
		const handleOpenTemplates = () => setIsTemplatesModalOpen(true);
		window.addEventListener("open-starter-templates", handleOpenTemplates);
		return () =>
			window.removeEventListener("open-starter-templates", handleOpenTemplates);
	}, []);

	function handleImportTemplate(template: CanvasTemplate) {
		const reactFlowInstance = reactFlowInstanceRef.current;
		if (!reactFlowInstance) return;

		const nodeChanges: NodeChange<CanvasNode>[] = [
			...nodes.map((n) => ({ type: "remove" as const, id: n.id })),
			...template.nodes.map((n) => ({ type: "add" as const, item: n })),
		];

		const edgeChanges: EdgeChange<CanvasEdge>[] = [
			...edges.map((e) => ({ type: "remove" as const, id: e.id })),
			...template.edges.map((e) => ({ type: "add" as const, item: e })),
		];

		onNodesChange(nodeChanges);
		onEdgesChange(edgeChanges);

		setTimeout(() => {
			reactFlowInstance.fitView({ duration: 500 });
		}, 50);
	}

	const undo = useUndo();
	const redo = useRedo();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();

	useKeyboardShortcuts({
		reactFlowInstanceRef,
		onUndo: undo,
		onRedo: redo,
	});

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		if (event.dataTransfer.types.includes(SHAPE_DRAG_MIME_TYPE)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
			moveDragPreview(event);
		}
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragPreview(null);

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
				textColor: DEFAULT_TEXT_COLOR,
				shape: payload.shape,
			},
		};
		const changes: NodeChange<CanvasNode>[] = [{ type: "add", item: node }];

		onNodesChange(changes);
	}

	function handleShapeDragStart(
		event: DragEvent<HTMLButtonElement>,
		shape: NodeShape,
	) {
		const payload = startShapeDrag(event, shape);

		setDragPreview({
			...payload,
			x: event.clientX,
			y: event.clientY,
		});
	}

	function handleShapeDragMove(event: DragEvent<HTMLButtonElement>) {
		moveDragPreview(event);
	}

	function moveDragPreview(
		event: DragEvent<HTMLButtonElement | HTMLDivElement>,
	) {
		if (event.clientX === 0 && event.clientY === 0) return;

		setDragPreview((preview) =>
			preview
				? {
						...preview,
						x: event.clientX,
						y: event.clientY,
					}
				: preview,
		);
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
				edgeTypes={edgeTypes}
				defaultEdgeOptions={defaultEdgeOptions}
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
				<Background variant={BackgroundVariant.Dots} />
				<CanvasControlBar
					canUndo={canUndo}
					canRedo={canRedo}
					onUndo={undo}
					onRedo={redo}
				/>
				<ShapePanel
					onShapeDragStart={handleShapeDragStart}
					onShapeDragMove={handleShapeDragMove}
					onShapeDragEnd={() => setDragPreview(null)}
				/>
			</ReactFlow>
			<ShapeDragPreview preview={dragPreview} />
			<StarterTemplatesModal
				isOpen={isTemplatesModalOpen}
				onClose={() => setIsTemplatesModalOpen(false)}
				onImport={handleImportTemplate}
			/>
		</div>
	);
}

interface CanvasControlBarProps {
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
}

function CanvasControlBar({
	canUndo,
	canRedo,
	onUndo,
	onRedo,
}: CanvasControlBarProps) {
	const { zoomIn, zoomOut, fitView } = useReactFlow();

	return (
		<div className="pointer-events-auto absolute bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="size-8 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary"
					onClick={() => zoomOut({ duration: 200 })}
					title="Zoom Out (-)"
				>
					<Minus className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary"
					onClick={() => fitView({ duration: 200 })}
					title="Fit View"
				>
					<Maximize className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary"
					onClick={() => zoomIn({ duration: 200 })}
					title="Zoom In (+)"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>

			<div className="h-4 w-px bg-surface-border" />

			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="size-8 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary disabled:opacity-30"
					onClick={onUndo}
					disabled={!canUndo}
					title="Undo (Cmd+Z)"
				>
					<Undo2 className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 rounded-full text-copy-secondary hover:bg-elevated hover:text-copy-primary disabled:opacity-30"
					onClick={onRedo}
					disabled={!canRedo}
					title="Redo (Cmd+Shift+Z)"
				>
					<Redo2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

function ShapePanel({
	onShapeDragStart,
	onShapeDragMove,
	onShapeDragEnd,
}: ShapePanelProps) {
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
					onDragStart={(event) => onShapeDragStart(event, shape)}
					onDrag={onShapeDragMove}
					onDragEnd={onShapeDragEnd}
				>
					<Icon className="h-4 w-4" />
				</Button>
			))}
		</div>
	);
}

function CanvasNodeRenderer({ id, data, selected }: NodeProps<CanvasNode>) {
	const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const minSize = SHAPE_MIN_SIZES[data.shape];
	const displayLabel =
		data.label.trim().length > 0 ? data.label : EMPTY_NODE_LABEL_PLACEHOLDER;

	useEffect(() => {
		if (!isEditing || !textareaRef.current) return;

		const frameId = window.requestAnimationFrame(() => {
			const textarea = textareaRef.current;

			if (!textarea) return;

			textarea.focus();
			textarea.setSelectionRange(textarea.value.length, textarea.value.length);
		});

		return () => window.cancelAnimationFrame(frameId);
	}, [isEditing]);

	useEffect(() => {
		if (!isEditing || !textareaRef.current) return;

		resizeLabelEditor(textareaRef.current);
	}, [data.label, isEditing]);

	function handleLabelChange(nextLabel: string) {
		reactFlow.updateNodeData(id, { label: nextLabel });
	}

	function handleLabelKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		event.stopPropagation();

		if (event.key !== "Escape") return;

		event.preventDefault();
		setIsEditing(false);
		event.currentTarget.blur();
	}

	return (
		<ShapeSurface
			shape={data.shape}
			fill={data.color}
			selected={selected}
			className="group h-full min-h-12 w-full min-w-24"
			style={{ color: data.textColor || DEFAULT_TEXT_COLOR }}
		>
			<NodeToolbar
				isVisible={selected}
				position={Position.Top}
				offset={12}
				className="nodrag nopan flex items-center gap-1.5 rounded-full border border-surface-border bg-surface/95 p-1.5 shadow-xl backdrop-blur"
			>
				{NODE_COLORS.map((palette) => {
					const isSelectedColor = data.color === palette.fill;
					return (
						<button
							key={palette.name}
							type="button"
							className={cn(
								"nodrag nopan flex size-4 cursor-pointer items-center justify-center rounded-full border transition-all",
								isSelectedColor
									? "scale-110 border-brand shadow-[0_0_0_2px_var(--color-surface),0_0_0_3px_var(--color-brand)]"
									: "border-surface-border-subtle hover:scale-110 hover:shadow-[0_0_8px_var(--swatch-glow)]",
							)}
							style={
								{
									backgroundColor: palette.fill,
									"--swatch-glow": palette.text,
								} as React.CSSProperties
							}
							onPointerDown={(event) => {
								event.stopPropagation();
								reactFlow.updateNodeData(id, {
									color: palette.fill,
									textColor: palette.text,
								});
							}}
							title={palette.name}
						/>
					);
				})}
			</NodeToolbar>
			<NodeResizer
				isVisible={selected}
				minWidth={minSize.width}
				minHeight={minSize.height}
				keepAspectRatio={data.shape === "circle"}
				handleClassName={NODE_RESIZER_HANDLE_CLASSNAME}
				lineClassName={NODE_RESIZER_LINE_CLASSNAME}
			/>
			<CanvasNodeHandles />
			<div className="absolute inset-3 z-10 flex items-center justify-center">
				{isEditing ? (
					<textarea
						ref={textareaRef}
						value={data.label}
						rows={1}
						spellCheck={false}
						className="nodrag nopan w-full max-w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-1 text-center text-sm font-medium outline-none placeholder:text-copy-faint"
						style={{ color: "inherit" }}
						placeholder={EMPTY_NODE_LABEL_PLACEHOLDER}
						onBlur={() => setIsEditing(false)}
						onChange={(event) => {
							resizeLabelEditor(event.currentTarget);
							handleLabelChange(event.target.value);
						}}
						onKeyDown={handleLabelKeyDown}
						onPointerDown={(event) => event.stopPropagation()}
					/>
				) : (
					<button
						type="button"
						className="nodrag nopan flex max-h-full w-full cursor-text items-center justify-center overflow-hidden bg-transparent px-2 py-1 text-center text-sm font-medium outline-none"
						style={{ color: "inherit" }}
						onDoubleClick={(event) => {
							event.stopPropagation();
							setIsEditing(true);
						}}
					>
						<span
							className={cn(
								"max-h-full whitespace-pre-wrap wrap-break-word",
								data.label.trim().length === 0 && "text-copy-faint",
							)}
						>
							{displayLabel}
						</span>
					</button>
				)}
			</div>
		</ShapeSurface>
	);
}

interface ShapeSurfaceProps {
	shape: NodeShape;
	fill: string;
	selected: boolean;
	className?: string;
	style?: React.CSSProperties;
	children?: ReactNode;
}

function ShapeSurface({
	shape,
	fill,
	selected,
	className,
	style,
	children,
}: ShapeSurfaceProps) {
	const strokeColor = selected
		? "var(--color-brand)"
		: "var(--color-surface-border-subtle)";
	const strokeWidth = selected ? 2 : 1.25;

	if (shape === "diamond" || shape === "hexagon" || shape === "cylinder") {
		return (
			<div
				className={cn(
					"relative flex h-full w-full items-center justify-center overflow-visible text-center shadow-lg",
					selected && "drop-shadow-[0_0_18px_var(--color-brand-dim)]",
					className,
				)}
				style={style}
			>
				<ShapeSvg
					shape={shape}
					fill={fill}
					strokeColor={strokeColor}
					strokeWidth={strokeWidth}
				/>
				{children}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative flex h-full w-full items-center justify-center overflow-visible text-center shadow-lg",
				className,
			)}
			style={style}
		>
			<div
				className={cn(
					"absolute inset-0 overflow-hidden border",
					shape === "rectangle" && "rounded-xl",
					shape === "pill" && "rounded-full",
					shape === "circle" && "rounded-full",
					selected
						? "border-brand shadow-[0_0_20px_var(--color-brand-dim)]"
						: "border-surface-border-subtle",
				)}
				style={{ backgroundColor: fill }}
			/>
			{children}
		</div>
	);
}

interface ShapeSvgProps {
	shape: "diamond" | "hexagon" | "cylinder";
	fill: string;
	strokeColor: string;
	strokeWidth: number;
}

function ShapeSvg({ shape, fill, strokeColor, strokeWidth }: ShapeSvgProps) {
	if (shape === "cylinder") {
		return (
			<svg
				className="absolute inset-0 h-full w-full overflow-visible"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				aria-hidden="true"
				focusable="false"
			>
				<path
					d="M 8 18 C 8 8, 92 8, 92 18 L 92 82 C 92 92, 8 92, 8 82 Z"
					fill={fill}
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					vectorEffect="non-scaling-stroke"
				/>
				<ellipse
					cx="50"
					cy="18"
					rx="42"
					ry="10"
					fill={fill}
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					vectorEffect="non-scaling-stroke"
				/>
				<path
					d="M 8 18 C 8 28, 92 28, 92 18"
					fill="none"
					stroke={strokeColor}
					strokeWidth={strokeWidth}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		);
	}

	const points =
		shape === "diamond"
			? "50,2 98,50 50,98 2,50"
			: "24,4 76,4 98,50 76,96 24,96 2,50";

	return (
		<svg
			className="absolute inset-0 h-full w-full overflow-visible"
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			aria-hidden="true"
			focusable="false"
		>
			<polygon
				points={points}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={strokeWidth}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function CanvasNodeHandles() {
	const handleClassName =
		"!size-2 !rounded-full !border !border-base !bg-copy-primary opacity-0 transition-opacity group-hover:opacity-100";

	// All handles declared as both source and target so connections can
	// originate from any side and land on any side.
	return (
		<>
			<Handle
				id="top"
				type="source"
				position={Position.Top}
				className={handleClassName}
			/>
			<Handle
				id="top-target"
				type="target"
				position={Position.Top}
				className="opacity-0"
				style={{ pointerEvents: "none" }}
			/>
			<Handle
				id="right"
				type="source"
				position={Position.Right}
				className={handleClassName}
			/>
			<Handle
				id="right-target"
				type="target"
				position={Position.Right}
				className="opacity-0"
				style={{ pointerEvents: "none" }}
			/>
			<Handle
				id="bottom"
				type="source"
				position={Position.Bottom}
				className={handleClassName}
			/>
			<Handle
				id="bottom-target"
				type="target"
				position={Position.Bottom}
				className="opacity-0"
				style={{ pointerEvents: "none" }}
			/>
			<Handle
				id="left"
				type="source"
				position={Position.Left}
				className={handleClassName}
			/>
			<Handle
				id="left-target"
				type="target"
				position={Position.Left}
				className="opacity-0"
				style={{ pointerEvents: "none" }}
			/>
		</>
	);
}

function ShapeDragPreview({
	preview,
}: {
	preview: ShapeDragPreviewState | null;
}) {
	if (!preview) return null;

	return (
		<div
			className="pointer-events-none fixed z-50 opacity-55"
			style={{
				left: preview.x,
				top: preview.y,
				width: preview.width,
				height: preview.height,
			}}
		>
			<ShapeSurface
				shape={preview.shape}
				fill={DEFAULT_NODE_COLOR}
				selected={false}
				className="text-copy-primary"
			/>
		</div>
	);
}

function resizeLabelEditor(textarea: HTMLTextAreaElement) {
	textarea.style.height = "0px";
	textarea.style.height = `${textarea.scrollHeight}px`;
}

function startShapeDrag(
	event: DragEvent<HTMLButtonElement>,
	shape: NodeShape,
): ShapeDragPayload {
	const size = SHAPE_DEFAULT_SIZES[shape];
	const payload: ShapeDragPayload = {
		shape,
		width: size.width,
		height: size.height,
	};

	event.dataTransfer.effectAllowed = "copy";
	event.dataTransfer.setData(SHAPE_DRAG_MIME_TYPE, JSON.stringify(payload));
	event.dataTransfer.setData("text/plain", shape);
	setTransparentDragImage(event);

	return payload;
}

function setTransparentDragImage(event: DragEvent<HTMLButtonElement>) {
	const dragImage = document.createElement("div");

	dragImage.style.width = "1px";
	dragImage.style.height = "1px";
	dragImage.style.opacity = "0";
	dragImage.style.position = "fixed";
	dragImage.style.pointerEvents = "none";
	document.body.appendChild(dragImage);
	event.dataTransfer.setDragImage(dragImage, 0, 0);
	window.setTimeout(() => dragImage.remove(), 0);
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
