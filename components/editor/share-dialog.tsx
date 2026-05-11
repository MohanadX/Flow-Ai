"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Share2, Trash2, UserPlus } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Collaborator {
	email: string;
	name: string | null;
	imageUrl: string | null;
	addedAt: string;
}

interface Owner {
	userId: string;
	email: string;
	name: string | null;
	imageUrl: string | null;
}

interface CollaboratorListResponse {
	owner: Owner;
	collaborators: Collaborator[];
}

interface ShareDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	projectName: string;
	isOwner: boolean;
}

// ─── query key factory ────────────────────────────────────────────────────────
const collaboratorKeys = {
	list: (projectId: string) => ["collaborators", projectId] as const,
};

// ─── fetch helpers ────────────────────────────────────────────────────────────
async function fetchCollaborators(
	projectId: string,
): Promise<CollaboratorListResponse> {
	const res = await fetch(`/api/projects/${projectId}/collaborators`);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error?.message ?? "Failed to load collaborators.");
	}
	return res.json() as Promise<CollaboratorListResponse>;
}

async function inviteCollaborator(
	projectId: string,
	email: string,
): Promise<Collaborator> {
	const res = await fetch(`/api/projects/${projectId}/collaborators`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email }),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error?.message ?? "Failed to invite collaborator.");
	}
	const data = await res.json();
	return data.collaborator as Collaborator;
}

async function removeCollaborator(
	projectId: string,
	email: string,
): Promise<void> {
	const res = await fetch(
		`/api/projects/${projectId}/collaborators/${encodeURIComponent(email)}`,
		{ method: "DELETE" },
	);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error?.message ?? "Failed to remove collaborator.");
	}
}

// ─── small reusable avatar ────────────────────────────────────────────────────
function MemberAvatar({
	name,
	email,
	imageUrl,
}: {
	name: string | null;
	email: string;
	imageUrl: string | null;
}) {
	if (imageUrl) {
		return (
			<Image
				src={imageUrl}
				alt={name ?? email}
				width={32}
				height={32}
				className="rounded-full shrink-0"
			/>
		);
	}
	return (
		<div className="h-8 w-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
			<span className="text-xs font-medium text-brand">
				{(name ?? email)[0]?.toUpperCase() ?? ""}
			</span>
		</div>
	);
}

// ─── component ────────────────────────────────────────────────────────────────
export function ShareDialog({
	open,
	onOpenChange,
	projectId,
	projectName,
	isOwner,
}: ShareDialogProps) {
	const queryClient = useQueryClient();
	const [inviteEmail, setInviteEmail] = useState("");
	const [copied, setCopied] = useState(false);
	const [mutationError, setMutationError] = useState<string | null>(null);
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// ── list query ──────────────────────────────────────────────────────────
	const {
		data,
		isLoading,
		error: queryError,
	} = useQuery({
		queryKey: collaboratorKeys.list(projectId),
		queryFn: () => fetchCollaborators(projectId),
		enabled: open,
	});

	const owner = data?.owner ?? null;
	const collaborators = data?.collaborators ?? [];

	// ── invite mutation ─────────────────────────────────────────────────────
	const inviteMutation = useMutation({
		mutationFn: (email: string) => inviteCollaborator(projectId, email),
		onSuccess: () => {
			setInviteEmail("");
			setMutationError(null);
			queryClient.invalidateQueries({
				queryKey: collaboratorKeys.list(projectId),
			});
		},
		onError: (err: Error) => {
			setMutationError(err.message);
		},
	});

	// ── remove mutation ─────────────────────────────────────────────────────
	const removeMutation = useMutation({
		mutationFn: (email: string) => removeCollaborator(projectId, email),
		onSuccess: () => {
			setMutationError(null);
			queryClient.invalidateQueries({
				queryKey: collaboratorKeys.list(projectId),
			});
		},
		onError: (err: Error) => {
			setMutationError(err.message);
		},
	});

	// ── handlers ────────────────────────────────────────────────────────────
	function handleInvite() {
		const trimmed = inviteEmail.trim();
		if (!trimmed || inviteMutation.isPending) return;
		setMutationError(null);
		inviteMutation.mutate(trimmed);
	}

	function handleRemove(email: string) {
		if (removeMutation.isPending) return;
		setMutationError(null);
		removeMutation.mutate(email);
	}

	function handleCopyLink() {
		const url = `${window.location.origin}/editor/${projectId}`;
		navigator.clipboard.writeText(url).then(() => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}
			setCopied(true);
			copyTimeoutRef.current = setTimeout(() => {
				setCopied(false);
				copyTimeoutRef.current = null;
			}, 2000);
		});
	}

	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current);
			}
		};
	}, []);

	const displayError =
		mutationError ?? (queryError instanceof Error ? queryError.message : null);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md bg-surface border-surface-border">
				<DialogHeader>
					<DialogTitle className="text-copy-primary flex items-center gap-2">
						<Share2 className="h-4 w-4 text-brand" />
						Share &ldquo;{projectName}&rdquo;
					</DialogTitle>
					<DialogDescription className="sr-only">
						Manage access and share this project with collaborators.
					</DialogDescription>
				</DialogHeader>

				{/* Copy link */}
				<div className="flex gap-2 mt-1">
					<Input
						readOnly
						value={
							typeof window !== "undefined"
								? `${window.location.origin}/editor/${projectId}`
								: ""
						}
						className="bg-elevated border-surface-border text-copy-muted font-mono text-xs"
					/>
					<Button
						size="icon"
						variant="outline"
						onClick={handleCopyLink}
						className="shrink-0 border-surface-border"
					>
						{copied ? (
							<Check className="h-4 w-4 text-success" />
						) : (
							<Copy className="h-4 w-4" />
						)}
						<span className="sr-only">{copied ? "Copied!" : "Copy link"}</span>
					</Button>
				</div>

				{/* Invite section — owners only */}
				{isOwner && (
					<div className="flex gap-2 mt-2">
						<Input
							placeholder="colleague@example.com"
							type="email"
							value={inviteEmail}
							onChange={(e) => {
								setInviteEmail(e.target.value);
								setMutationError(null);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !inviteMutation.isPending)
									handleInvite();
							}}
							className="bg-elevated border-surface-border text-copy-primary placeholder:text-copy-faint"
							disabled={inviteMutation.isPending}
						/>
						<Button
							size="icon"
							onClick={handleInvite}
							disabled={!inviteEmail.trim() || inviteMutation.isPending}
							className="shrink-0 bg-brand text-background hover:bg-brand/90"
						>
							{inviteMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<UserPlus className="h-4 w-4" />
							)}
							<span className="sr-only">Invite</span>
						</Button>
					</div>
				)}

				{/* Error */}
				{displayError && (
					<p className="text-xs text-error mt-1">{displayError}</p>
				)}

				{/* Member list */}
				<div className="mt-3">
					<p className="text-xs font-medium text-copy-muted uppercase tracking-wider mb-2">
						People with access
					</p>

					{isLoading ? (
						<div className="flex justify-center py-6">
							<Loader2 className="h-5 w-5 animate-spin text-copy-muted" />
						</div>
					) : (
						<ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
							{/* Owner row — always first */}
							{owner && (
								<li className="flex items-center gap-3 rounded-lg bg-brand/10 px-3 py-2 border border-brand/20">
									<MemberAvatar
										name={owner.name}
										email={owner.email}
										imageUrl={owner.imageUrl}
									/>
									<div className="flex-1 min-w-0">
										{owner.name && (
											<p className="text-sm font-medium text-copy-primary truncate">
												{owner.name}
											</p>
										)}
										<p className="text-xs text-copy-muted truncate">
											{owner.email}
										</p>
									</div>
									<span className="shrink-0 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
										Owner
									</span>
								</li>
							)}

							{/* Collaborators */}
							{collaborators.map((c) => (
								<li
									key={c.email}
									className="flex items-center gap-3 rounded-lg bg-elevated px-3 py-2 border border-surface-border"
								>
									<MemberAvatar
										name={c.name}
										email={c.email}
										imageUrl={c.imageUrl}
									/>

									<div className="flex-1 min-w-0">
										{c.name && (
											<p className="text-sm font-medium text-copy-primary truncate">
												{c.name}
											</p>
										)}
										<p className="text-xs text-copy-muted truncate">
											{c.email}
										</p>
									</div>

									{/* Remove — owners only */}
									{isOwner && (
										<Button
											variant="ghost"
											size="icon"
											className="h-7 w-7 shrink-0 text-copy-muted hover:text-error hover:bg-error/10"
											onClick={() => handleRemove(c.email)}
											disabled={
												removeMutation.isPending &&
												removeMutation.variables === c.email
											}
										>
											{removeMutation.isPending &&
											removeMutation.variables === c.email ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<Trash2 className="h-3.5 w-3.5" />
											)}
											<span className="sr-only">Remove {c.email}</span>
										</Button>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
