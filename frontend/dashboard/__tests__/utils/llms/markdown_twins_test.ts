import { describe, expect, it } from "@jest/globals";

import { walkPagesWithMd } from "@/app/utils/llms/marketing_pages";
import { MARKDOWN_TWIN_PATHS } from "@/app/utils/llms/markdown_twins";

describe("MARKDOWN_TWIN_PATHS", () => {
  it("lists every page.md twin under app/ and nothing else", () => {
    const onDisk = walkPagesWithMd()
      .map((page) => page.slug)
      .sort();
    expect([...MARKDOWN_TWIN_PATHS].sort()).toEqual(onDisk);
  });
});
