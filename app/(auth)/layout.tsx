import { ReactNode } from "react";
import { Users, Sparkles, FileText, LayoutTemplate } from "lucide-react";
import { Time } from "@/components/time";

const features = [
	{ text: "Real-time multiplayer canvas", Icon: Users },
	{ text: "AI-powered architecture generation", Icon: Sparkles },
	{ text: "Automated markdown spec creation", Icon: FileText },
	{ text: "Pre-built starter templates", Icon: LayoutTemplate },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen">
			{/* Left Panel - Hidden on small screens */}
			<div className="hidden lg:flex w-1/2 flex-col justify-between bg-surface p-12 border-r border-surface-border">
				<div>
					<div className="flex items-center gap-2 mb-12">
						<div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
							<span className="text-base font-bold">F</span>
						</div>
						<span className="text-xl font-bold text-copy-primary">Flow AI</span>
					</div>

					<h1 className="text-3xl font-bold text-copy-primary mb-4">
						System design, <br />
						accelerated by AI.
					</h1>
					<p className="text-copy-secondary mb-12 max-w-md">
						A collaborative workspace for architects and engineers. Generate,
						refine, and document your system architectures in real-time.
					</p>

					<ul className="space-y-4">
						{features.map(({ text, Icon }, i) => (
							<li
								key={i}
								className="flex items-center gap-3 text-copy-secondary"
							>
								<Icon className="w-5 h-5 text-brand" />
								<span>{text}</span>
							</li>
						))}
					</ul>
				</div>

				{/* make this inside client component	 */}
				<div className="text-sm text-copy-faint" suppressHydrationWarning>
					<Time />
				</div>
			</div>

			{/* Right Panel */}
			<div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 bg-base">
				<div className="mx-auto w-full max-w-sm flex justify-center">
					{children}
				</div>
			</div>
		</div>
	);
}
