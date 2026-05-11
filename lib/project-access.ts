import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Project } from "@/app/generated/prisma/client";

export interface Identity {
  userId: string;
  email: string | null;
}

export async function getCurrentIdentity(): Promise<Identity | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? null;

  return { userId, email };
}

export async function checkProjectAccess(
  projectId: string,
  identity: Identity
): Promise<Project | null> {
  const { userId, email } = identity;
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
