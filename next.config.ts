import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
	reactStrictMode: true,
	cacheComponents: true,
	compress: true,
	images: {
		formats: ["image/avif", "image/webp"],
		remotePatterns: [
			{
				protocol: "https",
				hostname: "img.clerk.com",
			},
			{
				protocol: "https",
				hostname: "api.dicebear.com",
			},
		],
	},
	poweredByHeader: false,
	experimental: {
		optimizePackageImports: ["lucide-react", "@heroicons/react"],
		hideLogsAfterAbort: true, // to hide logs emitted after a bail-out.
	},
};

export default nextConfig;
