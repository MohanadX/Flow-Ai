import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Project } from "@/app/generated/prisma/client";
import { getCachedClerkUser } from "@/lib/clerk-cache";

export interface Identity {
  userId: string;
  email: string | null;
}

export async function getCurrentIdentity(): Promise<Identity | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const cachedUser = await getCachedClerkUser(userId);
    return { userId, email: cachedUser.email };
  } catch (error) {
    console.error(error);
    return { userId, email: null };
  }
}

const _checkProjectAccess = cache(
  async (
    projectId: string,
    userId: string,
    email: string | null
  ): Promise<Project | null> => {
    const normalizedEmail = email?.trim().toLowerCase();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: true,
      },
    });

    if (!project) return null;

    const isOwner = project.ownerId === userId;
    const isCollaborator = normalizedEmail
      ? project.collaborators.some((c) => c.email === normalizedEmail)
      : false;

    if (isOwner || isCollaborator) {
      return project;
    }

    return null;
  }
);

export async function checkProjectAccess(
  projectId: string,
  identity: Identity
): Promise<Project | null> {
  return _checkProjectAccess(projectId, identity.userId, identity.email);
}
