import {
	type CanvasEdge,
	type CanvasNode,
	CANVAS_EDGE_TYPE,
	CANVAS_NODE_TYPE,
	NODE_COLORS,
	type NodeShape,
	SHAPE_DEFAULT_SIZES,
} from "@/types/canvas";

export interface CanvasTemplate {
	id: string;
	name: string;
	description: string;
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

function createNode(
	id: string,
	label: string,
	shape: NodeShape,
	x: number,
	y: number,
	colorIndex: number = 0,
): CanvasNode {
	const palette = NODE_COLORS[colorIndex];
	const size = SHAPE_DEFAULT_SIZES[shape];
	return {
		id,
		type: CANVAS_NODE_TYPE,
		position: { x, y },
		width: size.width,
		height: size.height,
		style: { width: size.width, height: size.height },
		data: {
			label,
			shape,
			color: palette.fill,
			textColor: palette.text,
		},
	};
}

function createEdge(
	id: string,
	source: string,
	target: string,
	label?: string,
): CanvasEdge {
	return {
		id,
		type: CANVAS_EDGE_TYPE,
		source,
		target,
		data: { label: label ?? "" },
	};
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
	{
		id: "microservices",
		name: "Microservices Architecture",
		description: "A standard web application with a load balancer, multiple services, and a database.",
		nodes: [
			createNode("client", "Client App", "rectangle", 0, 100, 1),
			createNode("lb", "Load Balancer", "hexagon", 250, 100, 0),
			createNode("auth", "Auth Service", "rectangle", 500, -50, 3),
			createNode("api", "API Gateway", "rectangle", 500, 100, 4),
			createNode("payment", "Payment Service", "rectangle", 500, 250, 6),
			createNode("db", "Primary DB", "cylinder", 800, 100, 2),
		],
		edges: [
			createEdge("e1", "client", "lb", "HTTPS"),
			createEdge("e2", "lb", "auth"),
			createEdge("e3", "lb", "api"),
			createEdge("e4", "lb", "payment"),
			createEdge("e5", "api", "db", "TCP"),
		],
	},
	{
		id: "cicd",
		name: "CI/CD Pipeline",
		description: "A deployment pipeline from code push to production.",
		nodes: [
			createNode("git", "Git Push", "circle", 0, 0, 0),
			createNode("build", "Build Container", "rectangle", 200, 0, 1),
			createNode("test", "Run Tests", "diamond", 450, -20, 4),
			createNode("deploy-staging", "Deploy Staging", "rectangle", 700, -100, 3),
			createNode("deploy-prod", "Deploy Prod", "rectangle", 700, 100, 6),
		],
		edges: [
			createEdge("e1", "git", "build"),
			createEdge("e2", "build", "test"),
			createEdge("e3", "test", "deploy-staging", "pass"),
			createEdge("e4", "test", "deploy-prod", "manual approval"),
		],
	},
	{
		id: "event-driven",
		name: "Event-Driven System",
		description: "Asynchronous processing with event streams and workers.",
		nodes: [
			createNode("producer1", "Web Events", "pill", 0, 0, 1),
			createNode("producer2", "Mobile Events", "pill", 0, 150, 2),
			createNode("kafka", "Event Bus (Kafka)", "cylinder", 300, 75, 3),
			createNode("worker1", "Analytics Worker", "rectangle", 600, -50, 6),
			createNode("worker2", "Notification Worker", "rectangle", 600, 200, 7),
			createNode("data-lake", "Data Lake", "cylinder", 900, -50, 0),
		],
		edges: [
			createEdge("e1", "producer1", "kafka", "publish"),
			createEdge("e2", "producer2", "kafka", "publish"),
			createEdge("e3", "kafka", "worker1", "consume"),
			createEdge("e4", "kafka", "worker2", "consume"),
			createEdge("e5", "worker1", "data-lake", "batch write"),
		],
	},
];
