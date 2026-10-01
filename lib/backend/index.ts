import "server-only";
import { isSupabaseMode } from "../config";
import { createClient } from "../supabase/server";
import { demoBackend } from "./demo";
import { SupabaseBackend } from "./supabase";
import type { Backend } from "./types";

export type { Backend } from "./types";

export async function getBackend(): Promise<Backend> {
  if (isSupabaseMode) return new SupabaseBackend(await createClient());
  return demoBackend();
}
