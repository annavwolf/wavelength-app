import type { MetadataRoute } from "next";

const SITE_URL = "https://wavelength.team";

// AI + search crawlers we explicitly welcome for discoverability (GEO/SEO).
// The `User-agent: *` rule below already allows everyone; these named entries
// document intent and make the allow-list unambiguous to each engine.
const ALLOWED_AI_CRAWLERS = [
  "GPTBot", // OpenAI training/index crawler
  "OAI-SearchBot", // OpenAI / ChatGPT search
  "ChatGPT-User", // ChatGPT user-initiated fetch
  "ClaudeBot", // Anthropic training/index crawler
  "Claude-User", // Claude user-initiated fetch
  "Claude-SearchBot", // Claude search
  "Google-Extended", // Google Gemini / AI answers
  "PerplexityBot", // Perplexity
  "CCBot", // Common Crawl (feeds many models)
  "Applebot-Extended", // Apple AI
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private/functional areas out of indexes without blocking crawlers.
        disallow: ["/api/", "/teams/", "/interview/", "/login"],
      },
      ...ALLOWED_AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
