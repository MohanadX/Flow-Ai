"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { Bot, Download, FileText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AiSidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

const starterPrompts = [
	"Design an e-commerce backend",
	"Create a chat app architecture",
	"Build a CI/CD pipeline",
];

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
	const [prompt, setPrompt] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	function resizeTextarea() {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
	}

	function submitPrompt(event?: FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		const trimmed = prompt.trim();
		if (!trimmed) return;

		setMessages((current) => [
			...current,
			{
				id: `user-${Date.now()}`,
				role: "user",
				content: trimmed,
			},
			{
				id: `assistant-${Date.now()}`,
				role: "assistant",
				content:
					"I can help map this into architecture nodes once generation is connected.",
			},
		]);
		setPrompt("");

		requestAnimationFrame(() => {
			const textarea = textareaRef.current;
			if (textarea) textarea.style.height = "72px";
		});
	}

	function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		submitPrompt();
	}

	return (
		<div
			aria-hidden={!isOpen}
			inert={!isOpen}
			className={cn(
				"fixed top-14 bottom-0 right-0 z-40 flex w-80 shrink-0 transform flex-col border-l border-surface-border bg-base/95 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out",
				isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
			)}
		>
			<header className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
				<div className="flex size-9 items-center justify-center rounded-xl border border-ai/30 bg-ai/15 text-ai-text">
					<Bot className="h-5 w-5" />
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-semibold text-copy-primary">
						AI Workspace
					</h2>
					<p className="truncate text-xs text-copy-muted">
						Collaborate with Flow AI
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close AI sidebar"
				>
					<X className="h-4 w-4" />
				</Button>
			</header>

			<Tabs defaultValue="architect" className="min-h-0 flex-1 gap-0">
				<div className="border-b border-surface-border px-4 py-3">
					<TabsList className="grid h-9 w-full grid-cols-2 bg-subtle p-1">
						<TabsTrigger
							value="architect"
							className="text-copy-muted data-active:bg-ai data-active:text-white"
						>
							AI Architect
						</TabsTrigger>
						<TabsTrigger
							value="specs"
							className="text-copy-muted data-active:bg-ai data-active:text-white"
						>
							Specs
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent
					value="architect"
					className="m-0 flex min-h-0 flex-col data-[state=inactive]:hidden"
				>
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						{messages.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
								<div className="flex size-12 items-center justify-center rounded-2xl border border-ai/30 bg-ai/15 text-ai-text">
									<Bot className="h-6 w-6" />
								</div>
								<div className="space-y-1">
									<h3 className="text-sm font-semibold text-copy-primary">
										Start shaping your system
									</h3>
									<p className="mx-auto max-w-56 text-xs leading-5 text-copy-muted">
										Ask Flow AI to sketch services, data flows, queues, and
										deployment boundaries.
									</p>
								</div>
								<div className="flex flex-wrap justify-center gap-2">
									{starterPrompts.map((starterPrompt) => (
										<button
											key={starterPrompt}
											type="button"
											onClick={() => {
												setPrompt(starterPrompt);
												requestAnimationFrame(resizeTextarea);
											}}
											className="rounded-full bg-subtle px-3 py-1.5 text-xs font-medium text-ai-text transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
										>
											{starterPrompt}
										</button>
									))}
								</div>
							</div>
						) : (
							<div className="flex flex-col gap-3">
								{messages.map((message) => (
									<div
										key={message.id}
										className={cn(
											"max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-5",
											message.role === "user"
												? "ml-auto border-2 border-brand/50 bg-brand-dim text-copy-primary"
												: "mr-auto border border-surface-border bg-elevated text-ai-text",
										)}
									>
										{message.content}
									</div>
								))}
							</div>
						)}
					</div>

					<form
						onSubmit={submitPrompt}
						className="border-t border-surface-border p-4"
					>
						<div className="flex items-end gap-2">
							<Textarea
								ref={textareaRef}
								value={prompt}
								onChange={(event) => {
									setPrompt(event.target.value);
									resizeTextarea();
								}}
								onKeyDown={handlePromptKeyDown}
								placeholder="Ask Flow AI to design..."
								className="max-h-40 min-h-[72px] resize-none overflow-y-auto border-surface-border bg-elevated text-sm text-copy-primary placeholder:text-copy-faint"
							/>
							<Button
								type="submit"
								size="icon-lg"
								disabled={!prompt.trim()}
								className="bg-ai text-white hover:bg-ai/90"
								aria-label="Send prompt"
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</form>
				</TabsContent>

				<TabsContent
					value="specs"
					className="m-0 flex min-h-0 flex-col gap-4 p-4 data-[state=inactive]:hidden"
				>
					<Button
						type="button"
						className="w-full bg-ai text-white hover:bg-ai/90"
					>
						<FileText className="mr-2 h-4 w-4" />
						Generate Spec
					</Button>

					<div className="rounded-2xl border border-surface-border bg-elevated p-4">
						<div className="flex items-start gap-3">
							<div className="flex size-9 items-center justify-center rounded-xl bg-subtle text-ai-text">
								<FileText className="h-5 w-5" />
							</div>
							<div className="min-w-0 flex-1 space-y-1">
								<h3 className="truncate text-sm font-semibold text-copy-primary">
									System Design Spec
								</h3>
								<p className="line-clamp-3 text-xs leading-5 text-copy-muted">
									Static preview of the future generated Markdown spec with
									architecture overview, service responsibilities, and data flow
									notes.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled
							className="mt-4 w-full"
						>
							<Download className="mr-2 h-4 w-4" />
							Download
						</Button>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
