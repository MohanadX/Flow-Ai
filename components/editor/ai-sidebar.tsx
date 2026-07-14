"use client";

import {
	FormEvent,
	KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { JsonObject } from "@liveblocks/core";
import {
	shallow,
	useCreateFeed,
	useCreateFeedMessage,
	useFeedMessages,
	useSelf,
	useStatus,
	useStorage,
} from "@liveblocks/react";
import { Bot, Download, FileText, Send, X, Loader2, Zap, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	apiClient,
	getApiClientErrorMessage,
	isApiClientRequestCanceled,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAiStatus } from "@/components/editor/editor-chrome";
import {
	AI_CHAT_FEED_ID,
	type AiChatMessageData,
	isAiChatMessageData,
} from "@/types/tasks";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import type { GenerateSpecRequest } from "@/types/spec-generation";

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

interface ProjectSpecListItem {
	id: string;
	projectId: string;
	createdAt: string;
}

const starterPrompts = [
	"Design an e-commerce backend",
	"Create a chat app architecture",
	"Build a CI/CD pipeline",
];

export function AiSidebar({ isOpen, onClose, projectId }: AiSidebarProps) {
	const [prompt, setPrompt] = useState("");
	const [submittingProjectId, setSubmittingProjectId] = useState<
		string | null
	>(null);
	const [sendError, setSendError] = useState<string | undefined>();
	const [runId, setRunId] = useState<string | undefined>();
	const [publicToken, setPublicToken] = useState<string | undefined>();
	const [specRunId, setSpecRunId] = useState<string | undefined>();
	const [specPublicToken, setSpecPublicToken] = useState<string | undefined>();
	const [selectedSpec, setSelectedSpec] = useState<
		ProjectSpecListItem | undefined
	>();
	const [prevProjectId, setPrevProjectId] = useState(projectId);

	if (projectId !== prevProjectId) {
		setPrevProjectId(projectId);
		setRunId(undefined);
		setPublicToken(undefined);
		setSpecRunId(undefined);
		setSpecPublicToken(undefined);
		setSelectedSpec(undefined);
	}
	// True once createFeed has resolved (success or already-exists), meaning the
	// feed exists and useFeedMessages errors should be treated as real failures.
	const [isFeedReady, setIsFeedReady] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isMountedRef = useRef(true);
	const submitAbortControllerRef = useRef<AbortController | null>(null);
	const queryClient = useQueryClient();
	const self = useSelf();
	const status = useStatus();
	const createFeed = useCreateFeed();
	const createFeedMessage = useCreateFeedMessage();

	// Shared AI activity state from the Liveblocks ai-status-feed (visible to all participants).
	const { sharedAiStatus } = useAiStatus();
	const isSubmitting = submittingProjectId === projectId;
	const isRunActive = !!runId;
	const isSpecRunActive = !!specRunId;
	const specsQuery = useQuery({
		queryKey: specKeys.list(projectId),
		queryFn: ({ signal }) => fetchProjectSpecs(projectId, signal),
		enabled: isOpen,
	});
	const selectedSpecDownloadUrl = selectedSpec
		? getSpecDownloadUrl(projectId, selectedSpec.id)
		: undefined;
	const specPreviewQuery = useQuery({
		queryKey: selectedSpec
			? specKeys.preview(projectId, selectedSpec.id)
			: specKeys.preview(projectId, ""),
		queryFn: ({ signal }) => {
			if (!selectedSpec) {
				throw new Error("No spec selected.");
			}

			return fetchSpecMarkdown(projectId, selectedSpec.id, signal);
		},
		enabled: !!selectedSpec,
		gcTime: 0,
		staleTime: 0,
	});

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		return () => {
			submitAbortControllerRef.current?.abort();
			submitAbortControllerRef.current = null;
		};
	}, [projectId]);

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

	const pushChatMessage = useCallback(async (payload: AiChatMessageData) => {
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
	}, [createFeedMessage]);

	async function submitPrompt(event?: FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		const trimmed = prompt.trim();
		if (!trimmed || isInputLocked) return;

		setSubmittingProjectId(projectId);
		setSendError(undefined);
		submitAbortControllerRef.current?.abort();
		const abortController = new AbortController();
		submitAbortControllerRef.current = abortController;

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
			if (abortController.signal.aborted) return;

			const { data: designData } = await apiClient.post<{
				runId?: unknown;
			}>(
				"/api/ai/design",
				{
					prompt: trimmed,
					roomId: projectId,
					projectId,
				},
				{ signal: abortController.signal },
			);
			const nextRunId =
				typeof designData.runId === "string" ? designData.runId : undefined;

			if (!nextRunId) {
				throw new Error("Design run id is missing from API response.");
			}

			const { data: tokenData } = await apiClient.post<{ token?: unknown }>(
				"/api/ai/design/token",
				{ runId: nextRunId },
				{ signal: abortController.signal },
			);
			const nextPublicToken =
				typeof tokenData.token === "string" ? tokenData.token : undefined;

			if (!nextPublicToken) {
				throw new Error("Run public token is missing.");
			}

			if (abortController.signal.aborted) return;
			setRunId(nextRunId);
			setPublicToken(nextPublicToken);
			setPrompt("");
		} catch (err) {
			if (
				abortController.signal.aborted ||
				isApiClientRequestCanceled(err)
			) {
				return;
			}

			console.error("Failed to submit AI prompt", err);
			const errorText =
				getApiClientErrorMessage(err) ?? "Message could not be sent.";
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
			if (submitAbortControllerRef.current === abortController) {
				submitAbortControllerRef.current = null;
			}
			if (
				isMountedRef.current &&
				(submitAbortControllerRef.current === null ||
					submitAbortControllerRef.current === abortController)
			) {
				setSubmittingProjectId(null);
			}
		}
	}

	function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		submitPrompt();
	}

	const handleRunFinished = useCallback(async (
		status: "COMPLETED" | "FAILED" | "CANCELED",
	) => {
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
	}, [pushChatMessage]);

	const handleSpecRunFinished = useCallback(async (
		status: "COMPLETED" | "FAILED" | "CANCELED",
	) => {
		const summary =
			status === "COMPLETED"
				? "Spec generation completed."
				: status === "FAILED"
					? "Spec generation failed."
					: "Spec generation was canceled.";

		await pushChatMessage({
			sender: {
				id: "flow-ai",
				name: "Flow AI",
			},
			role: "assistant",
			content: summary,
			timestamp: new Date().toISOString(),
		});

		if (status === "COMPLETED") {
			await queryClient.invalidateQueries({
				queryKey: specKeys.list(projectId),
			});
		}

		setSpecRunId(undefined);
		setSpecPublicToken(undefined);
	}, [projectId, queryClient, pushChatMessage]);

	const handlePreviewOpenChange = useCallback((isPreviewOpen: boolean) => {
		if (isPreviewOpen) return;

		if (selectedSpec) {
			queryClient.removeQueries({
				queryKey: specKeys.preview(projectId, selectedSpec.id),
			});
		}
		setSelectedSpec(undefined);
	}, [projectId, queryClient, selectedSpec]);

	

	const handleSpecGenerationRunStarted = useCallback((nextRunId: string, nextPublicToken: string) => {
		setSpecRunId(nextRunId);
		setSpecPublicToken(nextPublicToken);
	}, []);

	

	const handleSpecGenerationError = useCallback(async (message: string) => {
		setSendError(message);
		await pushChatMessage({
			sender: {
				id: "flow-ai",
				name: "Flow AI",
			},
			role: "assistant",
			content: message,
			timestamp: new Date().toISOString(),
		});
	}, [pushChatMessage]);

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
			{specRunId && specPublicToken ? (
				<RunTracker
					runId={specRunId}
					publicToken={specPublicToken}
					onFinished={handleSpecRunFinished}
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
					className="m-0 flex min-h-0 flex-col gap-3 p-4 data-[state=inactive]:hidden"
				>
					{isFeedReady ? (
						<SpecGenerationButton
							projectId={projectId}
							isSpecRunActive={isSpecRunActive}
							onRunStarted={handleSpecGenerationRunStarted}
							onError={handleSpecGenerationError}
						/>
					) : (
						<Button
							type="button"
							className="w-full bg-ai text-white hover:bg-ai/90"
							disabled
						>
							<FileText className="mr-2 h-4 w-4" />
							Generate Spec
						</Button>
					)}

					<ScrollArea className="min-h-0 flex-1 pr-3">
						{specsQuery.isLoading ? (
							<div className="flex min-h-32 items-center justify-center gap-2 text-xs text-copy-muted">
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading specs...
							</div>
						) : specsQuery.isError ? (
							<div className="rounded-2xl border border-surface-border bg-elevated p-4 text-xs text-error">
								Specs could not be loaded.
							</div>
						) : specsQuery.data?.length ? (
							<div className="flex flex-col w-[81%] gap-2">
								{specsQuery.data.map((spec) => (
									<div
										key={spec.id}
										role="button"
										tabIndex={0}
										onClick={() => setSelectedSpec(spec)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												setSelectedSpec(spec);
											}
										}}
										className="group flex w-full items-center gap-3 rounded-2xl border border-surface-border bg-elevated p-3 text-left transition hover:border-ai/40 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai/50"
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-subtle text-ai-text">
											<FileText className="h-4 w-4" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium text-copy-primary">
												{formatSpecFilename(spec)}
											</p>
											<p className="truncate text-xs text-copy-muted">
												{formatSpecCreatedAt(spec.createdAt)}
											</p>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label={`Download ${formatSpecFilename(spec)}`}
											onClick={(event) => {
												event.stopPropagation();
												window.location.assign(
													getSpecDownloadUrl(projectId, spec.id),
												);
											}}
											className="shrink-0 opacity-80 group-hover:opacity-100"
										>
											<Download className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-2xl border border-surface-border bg-elevated p-4 text-center">
								<div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-subtle text-ai-text">
									<FileText className="h-5 w-5" />
								</div>
								<h3 className="text-sm font-semibold text-copy-primary">
									No specs yet
								</h3>
								<p className="mt-1 text-xs leading-5 text-copy-muted">
									Generated specs will appear here for preview and download.
								</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>

			<Dialog open={!!selectedSpec} onOpenChange={handlePreviewOpenChange}>
				<DialogContent className="max-h-[min(720px,calc(100vh-2rem))] gap-0 rounded-3xl border border-surface-border bg-elevated p-0 sm:max-w-3xl">
					<DialogHeader className="border-b border-surface-border px-5 py-4 pr-12">
						<DialogTitle className="truncate text-copy-primary">
							{selectedSpec ? formatSpecFilename(selectedSpec) : "Spec Preview"}
						</DialogTitle>
						<DialogDescription className="text-copy-muted">
							{selectedSpec
								? formatSpecCreatedAt(selectedSpec.createdAt)
								: "Generated Markdown spec"}
						</DialogDescription>
					</DialogHeader>

					<ScrollArea className="min-h-0 max-h-[calc(100vh-14rem)] px-5 py-4">
						{specPreviewQuery.isLoading ? (
							<div className="flex min-h-72 items-center justify-center gap-2 text-sm text-copy-muted">
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading preview...
							</div>
						) : specPreviewQuery.isError ? (
							<div className="flex min-h-72 items-center justify-center text-center text-sm text-error">
								Spec preview could not be loaded.
							</div>
						) : (
							<MarkdownPreview content={specPreviewQuery.data ?? ""} />
						)}
					</ScrollArea>

					<DialogFooter className="rounded-b-3xl border-surface-border bg-subtle/50 px-5 py-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => setSelectedSpec(undefined)}
						>
							Close
						</Button>
						{selectedSpecDownloadUrl ? (
							<Button asChild className="bg-ai text-white hover:bg-ai/90">
								<a href={selectedSpecDownloadUrl}>
									<Download className="mr-2 h-4 w-4" />
									Download
								</a>
							</Button>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);

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
	const [retryKey, setRetryKey] = useState(0);

	// We append a dynamic query/suffix to the feed ID when we want to retry.
    // Liveblocks ignores URL-like search params in the ID string, but the changing 
    // string trick React/Liveblocks into resetting the fetch cache.
    const activeFeedId = `${AI_CHAT_FEED_ID}?retry=${retryKey}`;
	const feedMessagesResult = useFeedMessages(activeFeedId, { limit: 100 });
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

	const handleRetry = () => {
        // triggering a fresh network request!
        setRetryKey((prev) => prev + 1);
    };

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
			<div className="flex h-full flex-col items-center justify-center gap-3 text-center text-xs">
				<p className="text-error">Chat messages could not be loaded.</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleRetry}
					className="h-8 gap-1.5"
				>
					<RefreshCw className="h-3.5 w-3.5" />
					Retry
				</Button>
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



function SpecGenerationButton({
	projectId,
	isSpecRunActive,
	onRunStarted,
	onError,
}: {
	projectId: string;
	isSpecRunActive: boolean;
	onRunStarted: (runId: string, publicToken: string) => void;
	onError: (message: string) => Promise<void>;
}) {
	const [submittingProjectId, setSubmittingProjectId] = useState<
		string | null
	>(null);
	const isMountedRef = useRef(true);
	const requestAbortControllerRef = useRef<AbortController | null>(null);
	const nodes = useCanvasNodes();
	const edges = useCanvasEdges();
	const feedMessagesResult = useFeedMessages(AI_CHAT_FEED_ID, { limit: 100 });
	const chatHistory = useMemo(() => {
		const rawFeedMessages =
			"messages" in feedMessagesResult
				? (feedMessagesResult.messages ?? [])
				: [];

		return rawFeedMessages
			.map((message) => {
				if (!isAiChatMessageData(message.data)) return null;

				return {
					role: message.data.role,
					content: message.data.content,
					timestamp: message.data.timestamp,
					sender: message.data.sender,
				};
			})
			.filter(
				(message): message is NonNullable<typeof message> => message !== null,
			)
			.sort((a, b) => {
				const leftTime = new Date(a.timestamp).getTime();
				const rightTime = new Date(b.timestamp).getTime();
				return leftTime - rightTime;
			});
	}, [feedMessagesResult]);
	const isSubmitting = submittingProjectId === projectId;

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		return () => {
			requestAbortControllerRef.current?.abort();
			requestAbortControllerRef.current = null;
		};
	}, [projectId]);

	async function handleGenerateSpec() {
		if (isSubmitting || isSpecRunActive) return;

		setSubmittingProjectId(projectId);
		requestAbortControllerRef.current?.abort();
		const abortController = new AbortController();
		requestAbortControllerRef.current = abortController;

		try {
			const payload: GenerateSpecRequest = {
				roomId: projectId,
				chatHistory,
				nodes,
				edges,
			};
			const { data: specData } = await apiClient.post<
			{ runId?: unknown }>(
				"/api/ai/spec",
				payload,
				{ signal: abortController.signal },
			);
			const nextRunId =
				typeof specData.runId === "string" ? specData.runId : undefined;

			if (!nextRunId) {
				throw new Error("Spec run id is missing from API response.");
			}
			
			const { data: tokenData } = await apiClient.post<{ token?: unknown }>(
				"/api/ai/spec/token",
				{ runId: nextRunId },
				{ signal: abortController.signal },
			);			const nextPublicToken =
				typeof tokenData.token === "string" ? tokenData.token : undefined;

			if (!nextPublicToken) {
				throw new Error("Spec run public token is missing.");
			}


			if (abortController.signal.aborted) return;
			onRunStarted(nextRunId, nextPublicToken);
		} catch (error) {
			if (
				abortController.signal.aborted ||
				isApiClientRequestCanceled(error)
			) {
				return;
			}

			console.error("Failed to generate spec", error);
			const message =
				getApiClientErrorMessage(error) ??
				"Spec generation could not be started.";
			await onError(message);
		} finally {
			if (requestAbortControllerRef.current === abortController) {
				requestAbortControllerRef.current = null;
			}
			if (
				isMountedRef.current &&
				(requestAbortControllerRef.current === null ||
					requestAbortControllerRef.current === abortController)
			) {
				setSubmittingProjectId(null);
			}
		}
	}

	return (
		<Button
			type="button"
			className="w-full bg-ai text-white hover:bg-ai/90"
			disabled={isSubmitting || isSpecRunActive}
			onClick={handleGenerateSpec}
		>
			{isSubmitting || isSpecRunActive ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<FileText className="mr-2 h-4 w-4" />
			)}
			{isSubmitting
				? "Starting Spec"
				: isSpecRunActive
					? "Generating Spec"
					: "Generate Spec"}
		</Button>
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
	const { run, error } = useRealtimeRun(runId, { accessToken: publicToken });
	const handledStatusRef = useRef<string | null>(null);

	useEffect(() => {
		if (error) {
			if (handledStatusRef.current === "FAILED") return;
			console.error("Failed to subscribe to Trigger.dev run", error);
			handledStatusRef.current = "FAILED";
			onFinished("FAILED");
			return;
		}

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
	}, [error, onFinished, run?.status]);

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

interface FlowStorageSnapshot {
	flow?: {
		nodes?: Record<string, CanvasNode>;
		edges?: Record<string, CanvasEdge>;
	};
}

function useCanvasNodes(): CanvasNode[] {
	const nodesMap = useStorage((storage) => {
		const flow = (storage as unknown as FlowStorageSnapshot).flow;
		return flow?.nodes ?? null;
	}, shallow);

	return useMemo(() => {
		if (!nodesMap) return [];
		return Object.values(nodesMap);
	}, [nodesMap]);
}

function useCanvasEdges(): CanvasEdge[] {
	const edgesMap = useStorage((storage) => {
		const flow = (storage as unknown as FlowStorageSnapshot).flow;
		return flow?.edges ?? null;
	}, shallow);

	return useMemo(() => {
		if (!edgesMap) return [];
		return Object.values(edgesMap);
	}, [edgesMap]);
}

const specKeys = {
	list: (projectId: string) => ["project-specs", projectId] as const,
	preview: (projectId: string, specId: string) =>
		["project-specs", projectId, specId, "preview"] as const,
};

async function fetchProjectSpecs(
	projectId: string,
	signal?: AbortSignal,
): Promise<ProjectSpecListItem[]> {
	let body: { specs?: unknown };
	try {
		const response = await apiClient.get<{ specs?: unknown }>(
			`/api/projects/${encodeURIComponent(projectId)}/specs`,
			{ signal },
		);
		body = response.data;
	} catch (error) {
		if (isApiClientRequestCanceled(error)) throw error;

		throw new Error(
			getApiClientErrorMessage(error) ?? "Specs could not be loaded.",
		);
	}

	if (!Array.isArray(body.specs)) {
		throw new Error("Specs response is invalid.");
	}

	return body.specs.filter(isProjectSpecListItem);
}

async function fetchSpecMarkdown(
	projectId: string,
	specId: string,
	signal?: AbortSignal,
): Promise<string> {
	try {
		const { data } = await apiClient.get<string>(
			getSpecDownloadUrl(projectId, specId),
			{ responseType: "text", signal },
		);
		return data;
	} catch (error) {
		if (isApiClientRequestCanceled(error)) throw error;

		throw new Error(
			getApiClientErrorMessage(error) ?? "Spec preview could not be loaded.",
		);
	}
}

function isProjectSpecListItem(value: unknown): value is ProjectSpecListItem {
	if (typeof value !== "object" || value === null) return false;

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.id === "string" &&
		typeof candidate.projectId === "string" &&
		typeof candidate.createdAt === "string"
	);
}

function getSpecDownloadUrl(projectId: string, specId: string): string {
	return `/api/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(
		specId,
	)}/download`;
}

function formatSpecFilename(spec: ProjectSpecListItem): string {
	const date = new Date(spec.createdAt);
	const dateLabel = Number.isNaN(date.getTime())
		? "generated"
		: date.toISOString().slice(0, 10);
	const shortId = spec.id.slice(0, 8);

	return `system-design-spec-${dateLabel}-${shortId}.md`;
}

function formatSpecCreatedAt(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return "Unknown date";

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function MarkdownPreview({ content }: { content: string }) {
	const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);

	return (
		<div className="space-y-4 text-sm leading-6 text-copy-secondary">
			{blocks.length > 0 ? (
				blocks
			) : (
				<p className="text-copy-muted">This spec is empty.</p>
			)}
		</div>
	);
}

function parseMarkdownBlocks(content: string): ReactNode[] {
	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const blocks: ReactNode[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		const trimmed = line.trim();

		if (!trimmed) {
			index += 1;
			continue;
		}

		if (trimmed.startsWith("```")) {
			const codeLines: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index]?.trim().startsWith("```")) {
				codeLines.push(lines[index] ?? "");
				index += 1;
			}
			index += 1;
			blocks.push(
				<pre
					key={`code-${index}`}
					className="overflow-x-auto rounded-2xl border border-surface-border bg-base p-3 font-mono text-xs leading-5 text-copy-primary"
				>
					<code>{codeLines.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
		if (headingMatch) {
			const headingMarks = headingMatch[1];
			const text = headingMatch[2];
			if (!headingMarks || !text) {
				index += 1;
				continue;
			}

			const level = headingMarks.length;
			const className =
				level === 1
					? "text-xl font-semibold text-copy-primary"
					: level === 2
						? "text-base font-semibold text-copy-primary"
						: "text-sm font-semibold text-copy-primary";
			const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

			blocks.push(
				<Tag key={`heading-${index}`} className={className}>
					{renderInlineMarkdown(text)}
				</Tag>,
			);
			index += 1;
			continue;
		}

		if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
			const ordered = /^\d+\.\s+/.test(trimmed);
			const items: ReactNode[] = [];

			while (index < lines.length) {
				const itemLine = lines[index]?.trim() ?? "";
				const itemMatch = ordered
					? itemLine.match(/^\d+\.\s+(.+)$/)
					: itemLine.match(/^[-*]\s+(.+)$/);

				if (!itemMatch) break;

				items.push(
					<li key={`item-${index}`}>
						{renderInlineMarkdown(itemMatch[1] ?? "")}
					</li>,
				);
				index += 1;
			}

			const ListTag = ordered ? "ol" : "ul";
			blocks.push(
				<ListTag
					key={`list-${index}`}
					className={cn(
						"space-y-1 pl-5 text-copy-secondary",
						ordered ? "list-decimal" : "list-disc",
					)}
				>
					{items}
				</ListTag>,
			);
			continue;
		}

		if (trimmed.startsWith(">")) {
			blocks.push(
				<blockquote
					key={`quote-${index}`}
					className="border-l-2 border-ai/50 pl-3 text-copy-muted"
				>
					{renderInlineMarkdown(trimmed.replace(/^>\s?/, ""))}
				</blockquote>,
			);
			index += 1;
			continue;
		}

		const paragraphLines = [trimmed];
		index += 1;
		while (index < lines.length) {
			const nextLine = lines[index]?.trim() ?? "";
			if (
				!nextLine ||
				nextLine.startsWith("#") ||
				nextLine.startsWith("```") ||
				nextLine.startsWith(">") ||
				/^[-*]\s+/.test(nextLine) ||
				/^\d+\.\s+/.test(nextLine)
			) {
				break;
			}
			paragraphLines.push(nextLine);
			index += 1;
		}

		blocks.push(
			<p key={`paragraph-${index}`} className="text-copy-secondary">
				{renderInlineMarkdown(paragraphLines.join(" "))}
			</p>,
		);
	}

	return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
	const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

	return segments.map((segment, index) => {
		if (segment.startsWith("`") && segment.endsWith("`")) {
			return (
				<code
					key={`${segment}-${index}`}
					className="rounded-lg bg-subtle px-1.5 py-0.5 font-mono text-xs text-copy-primary"
				>
					{segment.slice(1, -1)}
				</code>
			);
		}

		if (segment.startsWith("**") && segment.endsWith("**")) {
			return (
				<strong
					key={`${segment}-${index}`}
					className="font-semibold text-copy-primary"
				>
					{segment.slice(2, -2)}
				</strong>
			);
		}

		return segment;
	});
}
