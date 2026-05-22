import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { listProjectGroups } from "@/lib/project-service";

export default async function EditorLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	const user = await getCachedClerkUser(userId);
	const projectLists = await listProjectGroups(userId, user.emailAddresses);

	return <EditorChrome {...projectLists}>{children}</EditorChrome>;
}
