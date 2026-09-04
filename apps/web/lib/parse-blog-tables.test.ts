import { splitAtMiddleHeading } from "./parse-blog-tables";

// The mid-article CTA is placed by this split, so a regression here drops an ad
// card into the middle of a paragraph on every post.
describe("splitAtMiddleHeading", () => {
  const post = [
    "Intro paragraph.",
    "## First section",
    "a".repeat(200),
    "## Middle section",
    "b".repeat(200),
    "## Last section",
    "c".repeat(50),
  ].join("\n\n");

  it("breaks at the interior heading nearest the midpoint", () => {
    const [before, after] = splitAtMiddleHeading(post);

    expect(after.startsWith("## Middle section")).toBe(true);
    expect(before + after).toBe(post);
  });

  it("never breaks at the first or last heading", () => {
    const [before, after] = splitAtMiddleHeading(
      ["## Only two", "x".repeat(500), "## Headings", "y"].join("\n\n"),
    );

    expect(before).toContain("## Only two");
    expect(after).toBe("");
  });

  it("returns an empty second half when there is nothing to split on", () => {
    expect(splitAtMiddleHeading("Just a paragraph.")).toEqual(["Just a paragraph.", ""]);
  });

  it("ignores a ## that is not at the start of a line", () => {
    const inline = "## Top\n\nA line mentioning ## hashes mid sentence.\n\n## Two\n\nend";

    expect(splitAtMiddleHeading(inline)[1]).toBe("");
  });
});
