import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CANVAS_TEMPLATES, type CanvasTemplate } from "./starter-templates";
import { type NodeShape } from "@/types/canvas";

interface StarterTemplatesModalProps {
	isOpen: boolean;
	onClose: () => void;
	onImport: (template: CanvasTemplate) => void;
}

export function StarterTemplatesModal({
	isOpen,
	onClose,
	onImport,
}: StarterTemplatesModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
				<DialogHeader className="px-6 py-4 border-b border-border">
					<DialogTitle className="text-white">Starter Templates</DialogTitle>
					<DialogDescription>
						Choose a template to quickly start your diagram. This will replace
						your current canvas.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="flex-1 p-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{CANVAS_TEMPLATES.map((template) => (
							<div
								key={template.id}
								className="flex flex-col bg-elevated border border-surface-border rounded-xl overflow-hidden hover:border-brand/50 transition-colors"
							>
								<div className="h-40 border-b border-surface-border bg-base flex items-center justify-center p-4 relative">
									<TemplatePreview template={template} />
								</div>
								<div className="p-4 flex flex-col flex-1">
									<h3 className="font-semibold text-copy-primary mb-1">
										{template.name}
									</h3>
									<p className="text-sm text-copy-muted mb-4 flex-1">
										{template.description}
									</p>
									<Button
										variant="secondary"
										className="w-full"
										onClick={() => {
											onImport(template);
											onClose();
										}}
									>
										Use Template
									</Button>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
	const { nodes, edges } = template;

	if (nodes.length === 0) return null;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const node of nodes) {
		const width = node.width ?? 100;
		const height = node.height ?? 100;
		if (node.position.x < minX) minX = node.position.x;
		if (node.position.y < minY) minY = node.position.y;
		if (node.position.x + width > maxX) maxX = node.position.x + width;
		if (node.position.y + height > maxY) maxY = node.position.y + height;
	}

	const padding = 50;
	const vbWidth = maxX - minX + padding * 2;
	const vbHeight = maxY - minY + padding * 2;
	const viewBox = `${minX - padding} ${minY - padding} ${vbWidth} ${vbHeight}`;

	return (
		<svg
			viewBox={viewBox}
			className="w-full h-full drop-shadow-sm pointer-events-none"
			preserveAspectRatio="xMidYMid meet"
		>
			{/* Edges */}
			{edges.map((edge) => {
				const sourceNode = nodes.find((n) => n.id === edge.source);
				const targetNode = nodes.find((n) => n.id === edge.target);

				if (!sourceNode || !targetNode) return null;

				const sx = sourceNode.position.x + (sourceNode.width ?? 100) / 2;
				const sy = sourceNode.position.y + (sourceNode.height ?? 100) / 2;
				const tx = targetNode.position.x + (targetNode.width ?? 100) / 2;
				const ty = targetNode.position.y + (targetNode.height ?? 100) / 2;

				return (
					<line
						key={edge.id}
						x1={sx}
						y1={sy}
						x2={tx}
						y2={ty}
						stroke="var(--color-copy-faint)"
						strokeWidth={4}
					/>
				);
			})}

			{/* Nodes */}
			{nodes.map((node) => {
				const x = node.position.x;
				const y = node.position.y;
				const w = node.width ?? 100;
				const h = node.height ?? 100;
				const shape = node.data.shape as NodeShape;
				const fill = node.data.color as string;
				const strokeColor = "var(--color-surface-border-subtle)";

				return (
					<g key={node.id} transform={`translate(${x}, ${y})`}>
						<PreviewShape
							shape={shape}
							w={w}
							h={h}
							fill={fill}
							strokeColor={strokeColor}
						/>
					</g>
				);
			})}
		</svg>
	);
}

function PreviewShape({
	shape,
	w,
	h,
	fill,
	strokeColor,
}: {
	shape: NodeShape;
	w: number;
	h: number;
	fill: string;
	strokeColor: string;
}) {
	if (shape === "rectangle") {
		return (
			<rect
				width={w}
				height={h}
				rx={12}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={2}
			/>
		);
	}
	if (shape === "circle") {
		return (
			<circle
				cx={w / 2}
				cy={h / 2}
				r={Math.min(w, h) / 2}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={2}
			/>
		);
	}
	if (shape === "pill") {
		return (
			<rect
				width={w}
				height={h}
				rx={h / 2}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={2}
			/>
		);
	}
	if (shape === "diamond") {
		const points = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
		return (
			<polygon
				points={points}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={2}
			/>
		);
	}
	if (shape === "hexagon") {
		const points = `${w * 0.25},0 ${w * 0.75},0 ${w},${h / 2} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h / 2}`;
		return (
			<polygon
				points={points}
				fill={fill}
				stroke={strokeColor}
				strokeWidth={2}
			/>
		);
	}
	if (shape === "cylinder") {
		const ry = h * 0.1;
		return (
			<g>
				<path
					d={`M 0,${ry} L 0,${h - ry} A ${w / 2},${ry} 0 0,0 ${w},${h - ry} L ${w},${ry} Z`}
					fill={fill}
					stroke={strokeColor}
					strokeWidth={2}
				/>
				<ellipse
					cx={w / 2}
					cy={ry}
					rx={w / 2}
					ry={ry}
					fill={fill}
					stroke={strokeColor}
					strokeWidth={2}
				/>
			</g>
		);
	}
	return (
		<rect
			width={w}
			height={h}
			rx={4}
			fill={fill}
			stroke={strokeColor}
			strokeWidth={2}
		/>
	);
}
