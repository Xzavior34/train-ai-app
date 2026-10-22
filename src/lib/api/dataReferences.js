import { supabase } from "../supabaseClient.js";
import { isRealDatabaseId } from "../mockDataManager.js";
import { PUBLIC_ORGANIZATIONS_DIRECTORY } from "./organizations.js";

export async function resolveOrganizationId(reference) {
  if (isRealDatabaseId(reference)) return reference;
  if (!reference || reference === "demo-org-id") throw new Error("Choose a saved organization to load its records.");

  if (supabase) {
    try {
      const { data, error } = await supabase.from("organizations").select("id").eq("slug", String(reference).trim()).maybeSingle();
      if (!error && data?.id) return data.id;
    } catch {}
  }

  const clean = String(reference).trim().toLowerCase();
  const dirMatch = PUBLIC_ORGANIZATIONS_DIRECTORY?.find(
    (item) =>
      item.id?.toLowerCase() === clean ||
      item.slug?.toLowerCase() === clean ||
      item.name?.toLowerCase() === clean ||
      (clean.includes("sara") && item.slug === "sara-foundation") ||
      ((clean.includes("digital") || clean.includes("tech")) && item.slug === "tech-learning")
  );
  if (dirMatch?.id) return dirMatch.id;
  return clean;
}
