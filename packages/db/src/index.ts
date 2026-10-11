import type { Kysely } from "kysely";
import type { Database } from "./types.ts";

export * from "./types.ts";

export type DBInstance = Kysely<Database>;
