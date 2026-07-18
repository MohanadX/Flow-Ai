"use client";

import { useOthers } from "@liveblocks/react/suspense";
import { UserButton, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useMemo } from "react";

export function PresenceAvatars() {
	const { user } = useUser(); // clerk client user info hook
	const others = useOthers(); // liveblocks hook for other users in the room

	const collaborators = useMemo(() => {
		const currentUserId = user?.id;
		if (!currentUserId) return [];

		const uniqueCollaborators = new Map();

		for (const other of others) {
			if (other.id !== currentUserId && !uniqueCollaborators.has(other.id)) {
				uniqueCollaborators.set(other.id, {
					id: other.id,
					info: other.info,
				});
			}
		}

		return Array.from(uniqueCollaborators.values());
	}, [others, user?.id]);

	const visibleCollaborators = collaborators.slice(0, 5);
	const overflowCount = Math.max(0, collaborators.length - 5);

	return (
		<div className="pointer-events-auto absolute right-4 top-4 z-50 flex items-center gap-2.5 rounded-full border border-surface-border bg-surface/90 p-1.5 shadow-xl backdrop-blur">
			{collaborators.length > 0 && (
				<>
					<div className="flex items-center pl-0.5">
						<div className="flex -space-x-2">
							{visibleCollaborators.map(({ id, info }) => (
								<div
									key={id}
									className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-muted ring-1 ring-surface-border-subtle"
									title={info?.displayName}
								>
									{info?.avatarUrl ? (
										<Image
											src={info.avatarUrl}
											alt={info.displayName || "Collaborator"}
											fill
											className="object-cover"
											unoptimized={/\.svg(?:$|\?|#)/i.test(info.avatarUrl || '') || info.avatarUrl?.includes('type=svg')}
											// next Image optimization doesn't work with svg since they are already optimized
											
										/>
									) : (
										<span className="text-xs font-medium text-copy-primary">
											{info?.displayName?.charAt(0).toUpperCase() || "?"}
										</span>
									)}
								</div>
							))}
							{overflowCount > 0 && (
								<div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-surface-border ring-1 ring-surface-border-subtle">
									<span className="text-xs font-medium text-copy-primary">
										+{overflowCount}
									</span>
								</div>
							)}
						</div>
					</div>
					<div className="h-5 w-px bg-surface-border" />
				</>
			)}
			<div className="flex h-8 w-8 items-center justify-center">
				<UserButton
					appearance={{
						elements: {
							userButtonAvatarBox: "h-8 w-8",
							userButtonPopoverCard: "pointer-events-auto",
						},
					}}
				/>
			</div>
		</div>
	);
}
