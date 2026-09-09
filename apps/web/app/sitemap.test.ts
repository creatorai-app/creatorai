import sitemap from "./sitemap";
import { CORE_FEATURES } from "@/lib/product-features";
import { FREE_TOOLS } from "@/lib/free-tools";

// The blog half of the sitemap reads the database, so it is stubbed here. That
// is also the reason /sitemap.xml cannot be checked by hand without credentials
// — this test is what stands in for that.
jest.mock("@/lib/blog-source", () => ({
  getPublishedPosts: jest.fn().mockResolvedValue([
    { slug: "a-post", updatedAt: "2026-01-01T00:00:00.000Z" },
  ]),
}));

const BASE = "https://trycreatorai.com";

describe("sitemap", () => {
  it("emits one URL per registered feature, derived from the registry", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    for (const feature of CORE_FEATURES) {
      expect(urls).toContain(`${BASE}/features/${feature.id}`);
    }
    expect(urls.filter((u) => /\/features\/[^/]+$/.test(u))).toHaveLength(
      CORE_FEATURES.length,
    );
  });

  // Regression: the hub is a separate staticPages entry, and adding the detail
  // pages must not displace it — /features is still the page that ranks.
  it("keeps the /features overview alongside the detail pages", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`${BASE}/features`);
  });

  it("does not emit a duplicate URL", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves the existing tool and blog entries intact", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const tool of FREE_TOOLS) {
      expect(urls).toContain(`${BASE}/tools/${tool.slug}`);
    }
    expect(urls).toContain(`${BASE}/blog/a-post`);
  });

  // Below the hub (0.9), above a blog post (0.7): these are primary marketing
  // pages but the hub is still the entry point.
  it("gives every feature page the same priority and change frequency", async () => {
    const entries = (await sitemap()).filter((entry) =>
      /\/features\/[^/]+$/.test(entry.url),
    );
    expect(entries).toHaveLength(CORE_FEATURES.length);
    for (const entry of entries) {
      expect(entry.priority).toBe(0.8);
      expect(entry.changeFrequency).toBe("monthly");
    }
  });
});
