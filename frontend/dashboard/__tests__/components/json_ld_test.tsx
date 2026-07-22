import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import JsonLd from "@/app/components/json_ld";

function renderedScript(data: Record<string, unknown>) {
  const { container } = render(<JsonLd data={data} />);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return script!;
}

describe("JsonLd", () => {
  it("renders the node with @context added", () => {
    const script = renderedScript({ "@type": "WebPage", name: "Pricing" });
    expect(JSON.parse(script.innerHTML)).toEqual({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Pricing",
    });
  });

  it("escapes < so content strings cannot close the script tag", () => {
    const name = "Broken </script><script>alert(1)</script> title";
    const script = renderedScript({ "@type": "WebPage", name });
    expect(script.innerHTML).not.toContain("</script>");
    expect(script.innerHTML).toContain("\\u003c");
    expect(JSON.parse(script.innerHTML).name).toBe(name);
  });
});
