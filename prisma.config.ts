import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { serverEnv } from "./env/server";

loadEnvConfig(process.cwd());

export default defineConfig({
	schema: "prisma/",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: serverEnv.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock", // for trigger dev
	},
});
