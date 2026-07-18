"use client";

import {
	type ComponentType,
	type DragEvent,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import {
	Cursors,
	type CursorsCursorProps,
	useLiveblocksFlow,
} from "@liveblocks/react-flow";
import {
	ClientSideSuspense,
	useCanRedo,
	useCanUndo,
	useRedo,
	useUndo,
	useUpdateMyPresence,
	useOther,
	useEventListener,
} from "@liveblocks/react/suspense";
import { isAiStatusPayload } from "@/types/tasks";
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
	DefaultEdgeOptions,
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
	Save,
	CheckCircle2,
	AlertCircle,
	Loader2,
} from "lucide-react";

import { CanvasEdgeRenderer } from "@/components/editor/canvas-edge";
import { CanvasErrorBoundary } from "@/components/editor/canvas-error-boundary";
import { PresenceAvatars } from "@/components/editor/presence-avatars";
import { Button } from "@/components/ui/button";
import { apiClient, getApiClientErrorMessage } from "@/lib/api-client";
import { cn, throttle } from "@/lib/utils";
import { useAiStatus } from "@/components/editor/editor-chrome";
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
	type CanvasSaveStatus,
	type CanvasSnapshot,
	type NodeShape,
	type ShapeDragPayload,
} from "@/types/canvas";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useCanvasAutosave } from "@/hooks/use-canvas-autosave";

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
	onPointerPresence: (event: React.PointerEvent<HTMLDivElement>) => void;
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

import dynamic from "next/dynamic";
const StarterTemplatesModal = dynamic(
	() =>
		import("@/components/editor/starter-templates-modal").then(
			(md) => md.StarterTemplatesModal,
		),
	{ ssr: false },
);
import type { CanvasTemplate } from "@/components/editor/starter-templates";

export function CollaborativeCanvas({ roomId }: CollaborativeCanvasProps) {
	return (
		<CanvasErrorBoundary fallback={<CanvasErrorState />}>
			<ClientSideSuspense fallback={<CanvasLoadingState />}>
				<BaseCanvas roomId={roomId} />
			</ClientSideSuspense>
		</CanvasErrorBoundary>
	);
}

interface BaseCanvasProps {
	roomId: string;
}

// in react compile and hot module replacements sometime function declare turn into variable assign
// so we make sure to define it before using it

const nodeTypes = {
	[CANVAS_NODE_TYPE]: CanvasNodeRenderer,
} satisfies NodeTypes;

const edgeTypes = {
	[CANVAS_EDGE_TYPE]: CanvasEdgeRenderer,
} satisfies EdgeTypes;

const defaultEdgeOptions = {
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
} satisfies DefaultEdgeOptions;

function BaseCanvas({ roomId }: BaseCanvasProps) {
	const { onAiStatus } = useAiStatus();
	const reactFlowInstanceRef = useRef<ReactFlowInstance<
		CanvasNode,
		CanvasEdge
	> | null>(null);
	const latestCanvasCountRef = useRef({ nodes: 0, edges: 0 });
	const nodeCounterRef = useRef(0);
	const [dragPreview, setDragPreview] = useState<ShapeDragPreviewState | null>(
		null,
	);
	const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
	const [isTemplatesModalMounted, setIsTemplatesModalMounted] = useState(false);
	const [isCanvasLoadChecked, setIsCanvasLoadChecked] = useState(false);
	const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
	const [, startTransition] = useTransition();
	const updateMyPresence = useUpdateMyPresence();
	const updateMyPresenceRef = useRef(updateMyPresence);

	const handleDragCleanup = useCallback(() => {
		setDragPreview(null);
	}, []);
	useEffect(() => {
		updateMyPresenceRef.current = updateMyPresence;
	}, [updateMyPresence]);

	// hold the throttled function instance safely
	const throttledUpdateMyPresenceRef = useRef<ReturnType<
		typeof throttle<(presence: Parameters<typeof updateMyPresence>[0]) => void>
	> | null>(null);

	// create and cleanup throttled function only once
	useEffect(() => {
		throttledUpdateMyPresenceRef.current = throttle((presence) => {
			updateMyPresenceRef.current(presence);
		}, 33);

		return () => throttledUpdateMyPresenceRef.current?.cancel();
	}, []);

	const closeTemplatesModal = useCallback(
		() => setIsTemplatesModalOpen(false),
		[],
	);
	// Bridge ai-status-feed events out of the RoomProvider to the AiStatusContext.
	useEventListener(({ event }) => {
		if (event.type !== "ai-status-feed") return;
		if (!isAiStatusPayload(event.payload)) return;
		onAiStatus(event.payload.text);
	});

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
	const autosave = useCanvasAutosave({
		projectId: roomId,
		nodes,
		edges,
		enabled: isCanvasLoadChecked,
	});

	if (!isCanvasLoadChecked && (nodes.length > 0 || edges.length > 0)) {
		setIsCanvasLoadChecked(true);
	}

	useEffect(() => {
		latestCanvasCountRef.current = {
			nodes: nodes.length,
			edges: edges.length,
		};
	}, [edges.length, nodes.length]);

	useEffect(() => {
		if (isCanvasLoadChecked) return;

		let isCurrentLoad = true;
		let timeoutId: number | null = null;

		const abortController = new AbortController();
		const signal = abortController.signal;

		async function loadSavedCanvas() {
			try {
				const { data } = await apiClient.get<unknown>(
					`/api/projects/${roomId}/canvas`,
					{
						timeout: 60000, // 1 min
						signal,
					},
				);

				if (!isCurrentLoad) return;

				const snapshot = parseCanvasLoadResponse(data);
				const latestCount = latestCanvasCountRef.current;

				if (snapshot && latestCount.nodes === 0 && latestCount.edges === 0) {
					startTransition(() => {
						if (snapshot.nodes.length > 0) {
							onNodesChange(
								snapshot.nodes.map((node) => ({
									type: "add" as const,
									item: node,
								})),
							);
						}

						if (snapshot.edges.length > 0) {
							onEdgesChange(
								snapshot.edges.map((edge) => ({
									type: "add" as const,
									item: edge,
								})),
							);
						}
					});

					timeoutId = window.setTimeout(() => {
						reactFlowInstanceRef.current?.fitView({ duration: 350 });
					}, 50);
				}
			} catch (error) {
				if (!isCurrentLoad) return;

				console.error(error);
				setLoadErrorMessage(
					getApiClientErrorMessage(error) ??
						"Saved canvas could not be loaded.",
				);
			} finally {
				if (isCurrentLoad) {
					setIsCanvasLoadChecked(true);
				}
			}
		}

		void loadSavedCanvas();

		return () => {
			isCurrentLoad = false;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			abortController.abort();
		};
	}, [
		edges.length,
		isCanvasLoadChecked,
		nodes.length,
		onEdgesChange,
		onNodesChange,
		roomId,
	]);

	useEffect(() => {
		const handleOpenTemplates = () => {
			setIsTemplatesModalMounted(true);
			setIsTemplatesModalOpen(true);
		};
		window.addEventListener("open-starter-templates", handleOpenTemplates);
		return () =>
			window.removeEventListener("open-starter-templates", handleOpenTemplates);
	}, []);

	const handleImportTemplate = useCallback(
		(template: CanvasTemplate) => {
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

			startTransition(() => {
				onNodesChange(nodeChanges);
				onEdgesChange(edgeChanges);
			});

			setTimeout(() => {
				reactFlowInstance.fitView({ duration: 500 });
			}, 50);
		},
		[nodes, edges, onNodesChange, onEdgesChange],
	);

	const undo = useUndo();
	const redo = useRedo();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();

	useKeyboardShortcuts({
		reactFlowInstanceRef,
		onUndo: undo,
		onRedo: redo,
	});

	const moveDragPreview = useCallback(
		(event: DragEvent<HTMLButtonElement | HTMLDivElement>) => {
			if (event.clientX === 0 && event.clientY === 0) return;
			setDragPreview((prev) =>
				prev
					? {
							...prev,
							x: event.clientX,
							y: event.clientY,
						}
					: null,
			);
		},
		[],
	);

	const handleDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (event.dataTransfer.types.includes(SHAPE_DRAG_MIME_TYPE)) {
				event.preventDefault();
				event.dataTransfer.dropEffect = "copy";
				moveDragPreview(event);
			}
		},
		[moveDragPreview],
	);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			handleDragCleanup();

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
					x: position.x - payload.width / 2,
					y: position.y - payload.height / 2,
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
		},
		[onNodesChange, handleDragCleanup],
	);

	const handleShapeDragStart = useCallback(
		(event: DragEvent<HTMLButtonElement>, shape: NodeShape) => {
			const payload = startShapeDrag(event, shape);
			setDragPreview({
				...payload,
				x: event.clientX,
				y: event.clientY,
			});
		},
		[],
	);

	const handleShapeDragMove = useCallback(
		(event: DragEvent<HTMLButtonElement>) => {
			moveDragPreview(event);
		},
		[moveDragPreview],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const reactFlowInstance = reactFlowInstanceRef.current;
			if (!reactFlowInstance) return;

			throttledUpdateMyPresenceRef.current?.({
				cursor: reactFlowInstance.screenToFlowPosition({
					x: event.clientX,
					y: event.clientY,
				}),
			});
		},
		[],
	);

	const handlePointerLeave = useCallback(() => {
		throttledUpdateMyPresenceRef.current?.cancel();
		updateMyPresence({ cursor: null });
	}, [updateMyPresence]);

	return (
		<div
			className="relative h-full w-full bg-base"
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
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
				deleteKeyCode={["Backspace", "Delete"]}
				multiSelectionKeyCode="Shift"
				onInit={(instance) => {
					reactFlowInstanceRef.current = instance;
				}}
				connectionMode={ConnectionMode.Loose}
				fitView
				onlyRenderVisibleElements={true}
			>
				<Cursors components={{ Cursor: CanvasCursor }} />
				<Background variant={BackgroundVariant.Dots} />
				<CanvasControlBar
					canUndo={canUndo}
					canRedo={canRedo}
					onUndo={undo}
					onRedo={redo}
					saveStatus={loadErrorMessage ? "error" : autosave.status}
					saveErrorMessage={loadErrorMessage ?? autosave.errorMessage}
					lastSavedAt={autosave.lastSavedAt}
				/>
				<ShapePanel
					onShapeDragStart={handleShapeDragStart}
					onShapeDragMove={handleShapeDragMove}
					onShapeDragEnd={handleDragCleanup}
					onPointerPresence={handlePointerMove}
				/>
				<PresenceAvatars />
			</ReactFlow>
			<ShapeDragPreview preview={dragPreview} />
			{isTemplatesModalMounted && (
				<StarterTemplatesModal
					isOpen={isTemplatesModalOpen}
					onClose={closeTemplatesModal}
					onImport={handleImportTemplate}
				/>
			)}
		</div>
	);
}

function CanvasNodeRenderer({ id, data, selected }: NodeProps<CanvasNode>) {
	const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [isEditing, setIsEditing] = useState(false);

	// Defensive guards: AI-generated updates can occasionally contain
	// unexpected or missing fields. Normalize here to avoid runtime crashes
	// in the renderer (e.g. accessing SHAPE_MIN_SIZES[undefined]).
	const safeShape = isNodeShape(data?.shape) ? data.shape : "rectangle";
	const minSize = SHAPE_MIN_SIZES[safeShape as NodeShape];
	const safeLabel = typeof data?.label === "string" ? data.label : "";
	const safeColor =
		typeof data?.color === "string" ? data.color : DEFAULT_NODE_COLOR;
	const safeTextColor =
		typeof data?.textColor === "string" ? data.textColor : DEFAULT_TEXT_COLOR;
	const displayLabel =
		safeLabel.trim().length > 0
			? safeLabel
			: EMPTY_NODE_LABEL_PLACEHOLDER;

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
	}, [isEditing, safeLabel]);

	const handleLabelChange = useCallback(
		(nextLabel: string) => {
			reactFlow.updateNodeData(id, { label: nextLabel });
		},
		[id, reactFlow],
	);

	const handleLabelKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			event.stopPropagation();

			if (event.key !== "Escape") return;

			event.preventDefault();
			setIsEditing(false);
			event.currentTarget.blur();
		},
		[],
	);

	return (
		<ShapeSurface
			shape={safeShape}
			fill={safeColor}
			selected={selected}
			className="group h-full min-h-12 w-full min-w-24"
			style={{ color: safeTextColor }}
		>
			<NodeToolbar
				isVisible={selected}
				position={Position.Top}
				offset={12}
				className="nodrag nopan flex items-center gap-1.5 rounded-full border border-surface-border bg-surface/95 p-1.5 shadow-xl backdrop-blur"
			>
				{NODE_COLORS.map((palette) => {
					const isSelectedColor = safeColor === palette.fill;
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
				minWidth={minSize?.width ?? SHAPE_MIN_SIZES.rectangle.width}
				minHeight={minSize?.height ?? SHAPE_MIN_SIZES.rectangle.height}
				keepAspectRatio={safeShape === "circle"}
				handleClassName={NODE_RESIZER_HANDLE_CLASSNAME}
				lineClassName={NODE_RESIZER_LINE_CLASSNAME}
			/>
			<CanvasNodeHandles />
			<div className="absolute inset-3 z-10 flex items-center justify-center">
				{isEditing ? (
					<textarea
						ref={textareaRef}
						value={safeLabel}
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
								safeLabel.trim().length === 0 && "text-copy-faint",
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

interface CanvasControlBarProps {
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	saveStatus: CanvasSaveStatus;
	saveErrorMessage: string | null;
	lastSavedAt: string | null;
}

function CanvasControlBar({
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	saveStatus,
	saveErrorMessage,
	lastSavedAt,
}: CanvasControlBarProps) {
	const { zoomIn, zoomOut, fitView } = useReactFlow();

	return (
		<div className="pointer-events-auto absolute bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
			<SaveStatusButton
				status={saveStatus}
				errorMessage={saveErrorMessage}
				lastSavedAt={lastSavedAt}
			/>

			<div className="h-4 w-px bg-surface-border" />

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

interface SaveStatusButtonProps {
	status: CanvasSaveStatus;
	errorMessage: string | null;
	lastSavedAt: string | null;
}

function SaveStatusButton({
	status,
	errorMessage,
	lastSavedAt,
}: SaveStatusButtonProps) {
	const statusLabel = getSaveStatusLabel(status);
	const title =
		status === "error"
			? (errorMessage ?? "Autosave failed")
			: lastSavedAt
				? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()}`
				: statusLabel;
	const Icon =
		status === "saving"
			? Loader2
			: status === "saved"
				? CheckCircle2
				: status === "error"
					? AlertCircle
					: Save;

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn(
				"h-8 rounded-full px-3 text-xs",
				status === "error"
					? "text-error hover:bg-error/10 hover:text-error"
					: "text-copy-secondary hover:bg-elevated hover:text-copy-primary",
			)}
			title={title}
			aria-label={title}
		>
			<Icon
				className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")}
			/>
			<span>{statusLabel}</span>
		</Button>
	);
}

function getSaveStatusLabel(status: CanvasSaveStatus): string {
	switch (status) {
		case "saving":
			return "Saving";
		case "saved":
			return "Saved";
		case "error":
			return "Error";
		case "idle":
			return "Autosave";
	}
}

function ShapePanel({
	onShapeDragStart,
	onShapeDragMove,
	onShapeDragEnd,
	onPointerPresence,
}: ShapePanelProps) {
	return (
		<div
			className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
			onPointerEnter={onPointerPresence}
			onPointerMove={onPointerPresence}
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

// NOTE: CanvasCursor must be a plain function component — NOT wrapped in memo().
// @liveblocks/react-flow's useStableComponent() calls the cursor component as a
// plain function: `Component2(props)`. A memo()-wrapped component is a React object,
// not a callable function, so calling it that way throws:
//   TypeError: Component2 is not a function
// Stability/memoization is already handled internally by useStableComponent's ref pattern.
function CanvasCursor({ connectionId }: CursorsCursorProps) {
	// Subscribe only to the exact primitive values we need so that cursor
	// coordinate updates on other users don't cause unnecessary re-renders here.
	const displayName = useOther(
		connectionId,
		(other) => other.info?.displayName,
	);
	const cursorColor = useOther(
		connectionId,
		(other) => other.info?.cursorColor || "#000",
	);
	const isThinking = useOther(
		connectionId,
		(other) => other.presence.isThinking,
	);

	if (!displayName) return null;

	return (
		<div className="pointer-events-none relative -left-1 -top-1 flex flex-col items-start drop-shadow-md">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill={cursorColor || "#000"}
				stroke="white"
				strokeWidth="1.5"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M5.65376 21.2087L2.7166 3.63345C2.46328 2.11802 4.09571 1.05061 5.41908 1.86532L21.3654 11.6881C22.6508 12.4799 22.4578 14.398 21.0456 14.8643L15.4215 16.7214L11.5303 21.7513C10.6358 22.9082 8.76106 22.6687 8.23274 21.3283L5.65376 21.2087Z" />
			</svg>
			<div
				className="ml-4 -mt-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white"
				style={{ backgroundColor: cursorColor || "#000" }}
			>
				{isThinking && (
					<Loader2 className="h-2.5 w-2.5 animate-spin opacity-80" />
				)}
				{displayName}
			</div>
		</div>
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
			className="pointer-events-none fixed left-0 top-0 z-50 opacity-55"
			style={{
				transform: `translate(${preview.x - preview.width / 2}px, ${preview.y - preview.height / 2}px)`,
				width: preview.width,
				height: preview.height,
				willChange: "transform",
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

function parseCanvasLoadResponse(value: unknown): CanvasSnapshot | null {
	if (!isRecord(value)) return null;

	if (value.canvas === null) return null;
	if (!isRecord(value.canvas)) return null;
	if (
		!Array.isArray(value.canvas.nodes) ||
		!Array.isArray(value.canvas.edges)
	) {
		return null;
	}

	return value.canvas as unknown as CanvasSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
