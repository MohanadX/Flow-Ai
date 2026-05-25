import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	compress: true,
	reactStrictMode: true,
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
		optimizePackageImports: ["lucide-react"],
	},
};

export default nextConfig;
