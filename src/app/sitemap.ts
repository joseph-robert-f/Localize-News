import type { MetadataRoute } from "next";
import { getActiveTownships } from "@/lib/db/townships";
import { STATE_NAMES } from "@/lib/constants/states";
import { countySlug } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://localizenews.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/request`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];

  let townships: Awaited<ReturnType<typeof getActiveTownships>> = [];
  try {
    townships = await getActiveTownships();
  } catch {
    // If DB is unreachable during static generation, return minimal sitemap
    return entries;
  }

  // State coverage pages — one per unique state represented
  const states = [...new Set(townships.map((t) => t.state))];
  for (const state of states) {
    if (!STATE_NAMES[state]) continue;
    entries.push({
      url: `${BASE_URL}/coverage/${state.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // County coverage pages
  const seenCounties = new Set<string>();
  for (const t of townships) {
    if (!t.county) continue;
    const key = `${t.state}/${countySlug(t.county)}`;
    if (seenCounties.has(key)) continue;
    seenCounties.add(key);
    entries.push({
      url: `${BASE_URL}/coverage/${t.state.toLowerCase()}/${countySlug(t.county)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Individual township pages
  for (const t of townships) {
    entries.push({
      url: `${BASE_URL}/townships/${t.id}`,
      lastModified: t.last_scraped_at ? new Date(t.last_scraped_at) : new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    });
  }

  return entries;
}
