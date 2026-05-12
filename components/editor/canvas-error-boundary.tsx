"use client";

import { Component, type ReactNode } from "react";

interface CanvasErrorBoundaryProps {
	children: ReactNode;
	fallback: ReactNode;
}

interface CanvasErrorBoundaryState {
	hasError: boolean;
}

export class CanvasErrorBoundary extends Component<
	CanvasErrorBoundaryProps,
	CanvasErrorBoundaryState
> {
	state: CanvasErrorBoundaryState = {
		hasError: false,
	};

	static getDerivedStateFromError(): CanvasErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: unknown) {
		console.error("Liveblocks canvas connection error", error);
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback;
		}

		return this.props.children;
	}
}
