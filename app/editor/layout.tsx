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

	const {emailAddresses, email} = await getCachedClerkUser(userId);
	if (emailAddresses.length === 0 || !email) {
		redirect("/sign-in")
	}
	const projectsData = await listProjectGroups(userId, emailAddresses);

	return <EditorChrome {...projectsData} userEmail={email}>{children}</EditorChrome>;
}
