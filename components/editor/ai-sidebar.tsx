"use client";

import {
	FormEvent,
	KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { JsonObject } from "@liveblocks/core";
import {
	useCreateFeed,
	useCreateFeedMessage,
	useFeedMessages,
	useSelf,
	useStatus,
} from "@liveblocks/react";
import { Bot, Download, FileText, Send, X, Loader2, Zap } from "lucide-react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiStatus } from "@/components/editor/editor-chrome";
import {
	AI_CHAT_FEED_ID,
	type AiChatMessageData,
	isAiChatMessageData,
} from "@/types/tasks";

interface AiSidebarProps {
	isOpen: boolean;
	onClose: () => void;
	projectId: string;
}

interface ChatMessageView {
	id: string;
	createdAt: number;
	senderId: string;
	senderName: string;
	role: "user" | "assistant";
	content: string;
	timestamp: string;
}

const starterPrompts = [
	"Design an e-commerce backend",
	"Create a chat app architecture",
	"Build a CI/CD pipeline",
];

export function AiSidebar({ isOpen, onClose, projectId }: AiSidebarProps) {
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [sendError, setSendError] = useState<string | undefined>();
	const [runId, setRunId] = useState<string | undefined>();
	const [publicToken, setPublicToken] = useState<string | undefined>();
	// True once createFeed has resolved (success or already-exists), meaning the
	// feed exists and useFeedMessages errors should be treated as real failures.
	const [isFeedReady, setIsFeedReady] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const self = useSelf();
	const status = useStatus();
	const createFeed = useCreateFeed();
	const createFeedMessage = useCreateFeedMessage();

	// Shared AI activity state from the Liveblocks ai-status-feed (visible to all participants).
	const { sharedAiStatus } = useAiStatus();
	const isRunActive = !!runId;

	useEffect(() => {
		// Only attempt feed creation once the room WebSocket is fully connected.
		// Calling createFeed while still connecting causes a "Feed mutation timeout".
		if (status !== "connected") return;

		let isMounted = true;

		createFeed(AI_CHAT_FEED_ID, {
			metadata: { kind: AI_CHAT_FEED_ID },
		})
			.then(() => {
				if (isMounted) setIsFeedReady(true);
			})
			.catch((error: unknown) => {
				if (!isMounted) return;
				if (isFeedAlreadyExistsError(error)) {
					// Feed already exists — safe to read messages.
					setIsFeedReady(true);
					return;
				}
				console.error("Failed to create AI chat feed", error);
				setSendError("Chat feed is unavailable.");
			});

		return () => {
			isMounted = false;
		};
	}, [createFeed, status]);

	function resizeTextarea() {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
	}

	const isInputLocked = !isFeedReady || isSubmitting || isRunActive;

	async function submitPrompt(event?: FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		const trimmed = prompt.trim();
		if (!trimmed || isInputLocked) return;

		setIsSubmitting(true);
		setSendError(undefined);

		requestAnimationFrame(() => {
			const textarea = textareaRef.current;
			if (textarea) textarea.style.height = "72px";
		});

		try {
			const timestamp = new Date().toISOString();
			const userPayload: AiChatMessageData = {
				sender: {
					id: self?.id ?? "unknown-user",
					name: self?.info.displayName ?? "Unknown user",
					avatarUrl: self?.info.avatarUrl || undefined,
				},
				role: "user",
				content: trimmed,
				timestamp,
			};

			await pushChatMessage(userPayload);

			const designResponse = await fetch("/api/ai/design", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt: trimmed,
					roomId: projectId,
					projectId,
				}),
			});

			if (!designResponse.ok) {
				const errorMessage = await readApiErrorMessage(designResponse);
				throw new Error(errorMessage ?? "Design run could not be started.");
			}

			const designData = (await designResponse.json()) as {
				runId?: unknown;
				publicToken?: unknown;
			};
			const nextRunId =
				typeof designData.runId === "string" ? designData.runId : undefined;
			const tokenFromDesign =
				typeof designData.publicToken === "string"
					? designData.publicToken
					: undefined;

			if (!nextRunId) {
				throw new Error("Design run id is missing from API response.");
			}

			let nextPublicToken = tokenFromDesign;

			if (!nextPublicToken) {
				const tokenResponse = await fetch("/api/ai/design/token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ runId: nextRunId }),
				});

				if (!tokenResponse.ok) {
					const errorMessage = await readApiErrorMessage(tokenResponse);
					throw new Error(errorMessage ?? "Run token could not be fetched.");
				}

				const tokenData = (await tokenResponse.json()) as { token?: unknown };
				nextPublicToken =
					typeof tokenData.token === "string" ? tokenData.token : undefined;
			}

			if (!nextPublicToken) {
				throw new Error("Run public token is missing.");
			}

			setRunId(nextRunId);
			setPublicToken(nextPublicToken);
			setPrompt("");
		} catch (err) {
			console.error("Failed to submit AI prompt", err);
			const errorText =
				err instanceof Error ? err.message : "Message could not be sent.";
			setSendError(errorText);

			await pushChatMessage({
				sender: {
					id: "flow-ai",
					name: "Flow AI",
				},
				role: "assistant",
				content: errorText,
				timestamp: new Date().toISOString(),
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		submitPrompt();
	}

	async function handleRunFinished(
		status: "COMPLETED" | "FAILED" | "CANCELED",
	) {
		const summary =
			status === "COMPLETED"
				? "Architecture generation completed."
				: status === "FAILED"
					? "Architecture generation failed."
					: "Architecture generation was canceled.";

		await pushChatMessage({
			sender: {
				id: "flow-ai",
				name: "Flow AI",
			},
			role: "assistant",
			content: summary,
			timestamp: new Date().toISOString(),
		});

		setRunId(undefined);
		setPublicToken(undefined);
	}

	return (
		<div
			aria-hidden={!isOpen}
			inert={!isOpen}
			className={cn(
				"fixed top-14 bottom-0 right-0 z-40 flex w-100 shrink-0 transform flex-col border-l border-surface-border bg-base/95 shadow-2xl backdrop-blur transition-all duration-300 ease-in-out",
				isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
			)}
		>
			{runId && publicToken ? (
				<RunTracker
					runId={runId}
					publicToken={publicToken}
					onFinished={handleRunFinished}
				/>
			) : null}

			<header className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
				<div className="relative flex size-9 items-center justify-center rounded-xl border border-ai/30 bg-ai/15 text-ai-text">
					<Bot className="h-5 w-5" />
					{isRunActive && (
						<span className="absolute -right-1 -top-1 flex size-3">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai opacity-60" />
							<span className="relative inline-flex size-3 rounded-full bg-ai" />
						</span>
					)}
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

			{/* Shared AI status feed — visible to every participant in the room */}
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
						{!isFeedReady ? (
							<div className="flex h-full items-center justify-center gap-2 text-xs text-copy-muted">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading chat...
							</div>
						) : (
							<ChatMessages
								selfId={self?.id}
								onPickStarterPrompt={(starterPrompt) => {
									setPrompt(starterPrompt);
									requestAnimationFrame(resizeTextarea);
								}}
								isInputLocked={isInputLocked}
							/>
						)}
					</div>

					<form
						onSubmit={submitPrompt}
						className="border-t border-surface-border p-4"
					>
						{isRunActive && (
							<div
								role="status"
								aria-live="polite"
								className="mb-2 flex items-center gap-2 rounded-xl border border-[#62C073]/35 bg-elevated px-3 py-2"
							>
								<Loader2 className="h-3 w-3 shrink-0 animate-spin text-[#62C073]" />
								<p className="truncate text-xs font-medium text-[#62C073]">
									{sharedAiStatus ?? "Flow AI is generating..."}
								</p>
								<Zap className="ml-auto h-3 w-3 shrink-0 text-[#62C073]/70" />
							</div>
						)}
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
								disabled={isInputLocked}
								className="max-h-40 min-h-18 resize-none overflow-y-auto border-surface-border bg-elevated text-sm text-copy-primary placeholder:text-copy-faint disabled:opacity-50"
							/>
							<Button
								type="submit"
								size="icon-lg"
								disabled={!prompt.trim() || isInputLocked}
								className="bg-[#62C073] text-base hover:bg-[#62C073]/90 disabled:opacity-50"
								aria-label="Send prompt"
							>
								{isSubmitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
							</Button>
						</div>
						{sendError && (
							<p className="mt-2 text-xs text-error" role="status">
								{sendError}
							</p>
						)}
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

	async function pushChatMessage(payload: AiChatMessageData) {
		try {
			await createFeedMessage(
				AI_CHAT_FEED_ID,
				payload as unknown as JsonObject,
				{
					id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					createdAt: Date.now(),
				},
			);
			setSendError(undefined);
		} catch (error) {
			console.error("Failed to push ai-chat message", error);
			setSendError("Chat feed write failed.");
		}
	}
}

function ChatMessages({
	selfId,
	onPickStarterPrompt,
	isInputLocked,
}: {
	selfId: string | undefined;
	onPickStarterPrompt: (prompt: string) => void;
	isInputLocked: boolean;
}) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const feedMessagesResult = useFeedMessages(AI_CHAT_FEED_ID, { limit: 100 });
	const isChatLoading =
		"isLoading" in feedMessagesResult ? feedMessagesResult.isLoading : false;
	const chatLoadError =
		"error" in feedMessagesResult ? feedMessagesResult.error : undefined;
	const messages = useMemo(() => {
		const rawFeedMessages =
			"messages" in feedMessagesResult
				? (feedMessagesResult.messages ?? [])
				: [];

		return rawFeedMessages
			.map((message): ChatMessageView | null => {
				if (!isAiChatMessageData(message.data)) return null;

				return {
					id: message.id,
					createdAt: message.createdAt,
					senderId: message.data.sender.id,
					senderName: message.data.sender.name,
					role: message.data.role,
					content: message.data.content,
					timestamp: message.data.timestamp,
				};
			})
			.filter((message): message is ChatMessageView => message !== null)
			.sort((a, b) => a.createdAt - b.createdAt);
	}, [feedMessagesResult]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	if (isChatLoading) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-xs text-copy-muted">
				<Loader2 className="h-3.5 w-3.5 animate-spin" />
				Loading chat...
			</div>
		);
	}

	if (chatLoadError) {
		return (
			<div className="flex h-full items-center justify-center text-center text-xs text-error">
				Chat messages could not be loaded.
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
				<div className="flex size-12 items-center justify-center rounded-2xl border border-ai/30 bg-ai/15 text-ai-text">
					<Bot className="h-6 w-6" />
				</div>
				<div className="space-y-1">
					<h3 className="text-sm font-semibold text-copy-primary">
						Start the room chat
					</h3>
					<p className="mx-auto max-w-56 text-xs leading-5 text-copy-muted">
						Share architecture notes with everyone in this project room.
					</p>
				</div>
				<div className="flex flex-wrap justify-center gap-2">
					{starterPrompts.map((starterPrompt) => (
						<button
							key={starterPrompt}
							type="button"
							disabled={isInputLocked}
							onClick={() => onPickStarterPrompt(starterPrompt)}
							className="rounded-full bg-subtle px-3 py-1.5 text-xs font-medium text-ai-text transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40"
						>
							{starterPrompt}
						</button>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{messages.map((message) => (
				<div
					key={message.id}
					className={cn(
						"flex max-w-[88%] flex-col gap-1 rounded-2xl px-3 py-2 text-sm leading-5",
						message.senderId === selfId
							? "ml-auto border border-[#62C073]/40 bg-[#62C073]/20 text-copy-primary"
							: message.role === "assistant"
								? "mr-auto border border-ai/30 bg-ai/15 text-ai-text"
								: "mr-auto border border-surface-border bg-elevated text-copy-primary",
					)}
				>
					<div className="flex items-center gap-2 text-[11px] leading-none text-copy-muted">
						<span className="max-w-28 truncate font-medium">
							{message.senderName}
						</span>
						<span>{formatChatTime(message.timestamp)}</span>
					</div>
					<p className="whitespace-pre-wrap wrap-break-word">
						{message.content}
					</p>
				</div>
			))}
			<div ref={messagesEndRef} />
		</div>
	);
}

function RunTracker({
	runId,
	publicToken,
	onFinished,
}: {
	runId: string;
	publicToken: string;
	onFinished: (status: "COMPLETED" | "FAILED" | "CANCELED") => void;
}) {
	const { run } = useRealtimeRun(runId, { accessToken: publicToken });
	const handledStatusRef = useRef<string | null>(null);

	useEffect(() => {
		if (!run?.status) return;
		if (
			run.status !== "COMPLETED" &&
			run.status !== "FAILED" &&
			run.status !== "CANCELED"
		) {
			return;
		}
		if (handledStatusRef.current === run.status) return;

		handledStatusRef.current = run.status;
		onFinished(run.status);
	}, [onFinished, run?.status]);

	return null;
}

function formatChatTime(timestamp: string): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return "";

	return date.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

function isFeedAlreadyExistsError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;

	const candidate = error as { code?: unknown; message?: unknown };

	return (
		candidate.code === "FEED_ALREADY_EXISTS" ||
		(typeof candidate.message === "string" &&
			candidate.message.includes("FEED_ALREADY_EXISTS"))
	);
}

async function readApiErrorMessage(
	response: Response,
): Promise<string | undefined> {
	try {
		const body = (await response.json()) as {
			error?: { message?: unknown };
		};
		const message = body.error?.message;
		return typeof message === "string" ? message : undefined;
	} catch {
		return undefined;
	}
}
