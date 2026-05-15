"use client";

import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	BaseEdge,
	EdgeLabelRenderer,
	type EdgeProps,
	getSmoothStepPath,
	useReactFlow,
} from "@xyflow/react";

import type { CanvasEdge, CanvasNode } from "@/types/canvas";

// Invisible wider path for easier hover/click without changing visible thickness.
const EDGE_INTERACTION_STROKE_WIDTH = 20;

export function CanvasEdgeRenderer({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	selected,
	data,
	markerEnd,
	style,
}: EdgeProps<CanvasEdge>) {
	const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [draft, setDraft] = useState<string>("");

	const label = data?.label ?? "";

	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: 8,
	});

	// Focus input immediately when editing starts
	useEffect(() => {
		if (!isEditing || !inputRef.current) return;
		inputRef.current.focus();
		inputRef.current.select();
	}, [isEditing]);

	function openEditor() {
		setDraft(label);
		setIsEditing(true);
	}

	const commitLabel = useCallback(
		(value: string) => {
			setIsEditing(false);
			reactFlow.updateEdgeData(id, { label: value.trim() });
		},
		[id, reactFlow],
	);

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		event.stopPropagation();
		if (event.key === "Enter") {
			event.preventDefault();
			commitLabel(draft);
		} else if (event.key === "Escape") {
			event.preventDefault();
			setIsEditing(false);
		}
	}

	const strokeColor = selected
		? "var(--color-copy-primary)"
		: "var(--color-copy-faint)";

	const hoverStrokeColor = "var(--color-copy-secondary)";

	return (
		<>
			{/* Invisible fat hit area — keeps visible edge thin */}
			<path
				d={edgePath}
				fill="none"
				stroke="transparent"
				strokeWidth={EDGE_INTERACTION_STROKE_WIDTH}
				onDoubleClick={(event) => {
					event.stopPropagation();
					openEditor();
				}}
			/>

			{/* Visible edge path */}
			<BaseEdge
				path={edgePath}
				markerEnd={markerEnd}
				style={{
					...style,
					stroke: strokeColor,
					strokeWidth: 1.5,
					strokeLinecap: "round",
					transition: "stroke 0.15s ease",
				}}
				className="canvas-edge group"
			/>

			{/* Arrow marker override via CSS so hover brightens it too */}
			<style>{`
				.canvas-edge:hover {
					stroke: ${hoverStrokeColor} !important;
				}
			`}</style>

			<EdgeLabelRenderer>
				<div
					style={{
						position: "absolute",
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						pointerEvents: "all",
					}}
					className="nodrag nopan"
				>
					{isEditing ? (
						<input
							ref={inputRef}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onBlur={() => commitLabel(draft)}
							onKeyDown={handleKeyDown}
							onPointerDown={(e) => e.stopPropagation()}
							onClick={(e) => e.stopPropagation()}
							placeholder="Label…"
							className="nodrag nopan rounded-full border border-surface-border bg-surface/95 px-2.5 py-0.5 text-center text-xs font-medium text-copy-primary shadow-lg outline-none backdrop-blur placeholder:text-copy-faint focus:border-brand focus:ring-1 focus:ring-brand"
							style={{
								minWidth: "4ch",
								width: `${Math.max(draft.length + 2, 6)}ch`,
							}}
						/>
					) : label ? (
						/* Saved label — pill badge */
						<button
							type="button"
							className="nodrag nopan cursor-pointer rounded-full border border-surface-border bg-surface/90 px-2.5 py-0.5 text-xs font-medium text-copy-secondary shadow backdrop-blur transition-colors hover:border-surface-border-subtle hover:text-copy-primary"
							onDoubleClick={(e) => {
								e.stopPropagation();
								openEditor();
							}}
							onPointerDown={(e) => e.stopPropagation()}
						>
							{label}
						</button>
					) : selected ? (
						/* Ghost hint when selected but no label */
						<button
							type="button"
							className="nodrag nopan cursor-text rounded-full border border-dashed border-surface-border/50 px-2.5 py-0.5 text-xs text-copy-faint opacity-70 transition-opacity hover:opacity-100"
							onDoubleClick={(e) => {
								e.stopPropagation();
								openEditor();
							}}
							onPointerDown={(e) => e.stopPropagation()}
						>
							Add label…
						</button>
					) : null}
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
