export default function PageLoader() {
	return (
		<div
			className="flex min-h-screen w-full flex-col items-center justify-center bg-background gap-4"
			aria-label="Loading"
			aria-busy="true"
			aria-live="assertive"
			aria-hidden="false"
		>
			<div className="relative flex items-center justify-center">
				{/* Outer Ring */}
				<div className="h-24 w-24 animate-[spin_3s_linear_infinite] rounded-full border-b-4 border-t-4 border-primary opacity-30"></div>

				{/* Middle Ring */}
				<div className="absolute h-16 w-16 animate-[spin_2s_linear_infinite_reverse] rounded-full border-r-4 border-l-4 border-primary/60"></div>

				{/* Inner Ring */}
				<div className="absolute h-8 w-8 animate-spin rounded-full border-t-4 border-primary"></div>
			</div>

			{/* Text */}
			<div className="flex items-center gap-1 font-mono text-lg font-bold text-primary">
				<span>LOADING</span>
				<span className="animate-bounce delay-0">.</span>
				<span className="animate-[bounce_1s_infinite_100ms] delay-100">.</span>
				<span className="animate-[bounce_1s_infinite_200ms] delay-200">.</span>
			</div>
		</div>
	);
}
