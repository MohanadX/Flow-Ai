import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EditorChrome } from "@/components/editor/editor-chrome";
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

	const user = await currentUser();
	const projectLists = await listProjectGroups(
		userId,
		user?.emailAddresses.map((email) => email.emailAddress) ?? [],
	);

	return <EditorChrome {...projectLists}>{children}</EditorChrome>;
}
