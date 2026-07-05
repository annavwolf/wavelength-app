import type { MetadataRoute } from "next";

const SITE_URL = "https://wavelength.team";

// Only public, indexable pages belong here. The app's authenticated areas
// (/login, /teams/*, /interview/*) and /api/* routes are intentionally omitted.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
