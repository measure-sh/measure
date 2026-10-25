import {
  demoErrors,
  demoJourney,
  demoNetwork,
  demoPathUsers,
} from "@/app/components/journey/demo_data";
import { RootSpanMetricsQuantile } from "@/app/query/hooks";
import { JourneysDemo } from "@/app/components/journey/overview";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

// The graph sizes itself from ResizeObserver, which jsdom lacks.
beforeAll(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  delete (globalThis as any).ResizeObserver;
});

describe("JourneysDemo", () => {
  it("shows the title", () => {
    render(<JourneysDemo />);

    expect(screen.getByText("User Journeys")).toBeInTheDocument();
  });

  it("hides the title when asked", () => {
    render(<JourneysDemo hideTitle />);

    expect(screen.queryByText("User Journeys")).toBeNull();
  });

  it("draws the demo journey without the focus picker", () => {
    render(<JourneysDemo />);

    expect(screen.getByText("SearchActivity")).toBeInTheDocument();
    expect(screen.getByText("added_to_cart")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Focus node" })).toBeNull();
  });

  it("opens with the network requests of the purchase path", () => {
    render(<JourneysDemo />);

    expect(
      screen.getByText("api.acme.shop/v1/promotions/validate"),
    ).toBeInTheDocument();
    expect(screen.getByText("19.06K", { selector: "p" })).toBeInTheDocument();
  });

  it("links its rows nowhere", () => {
    render(<JourneysDemo />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("demo lists", () => {
  it("gives a link the users of the link", () => {
    expect(
      demoPathUsers(["cart_viewed", "com.acme.shop.checkout.CheckoutActivity"]),
    ).toBe(45_120);
  });

  it("puts a path together from its links", () => {
    const path = [
      "com.acme.shop.cart.CartFragment",
      "cart_viewed",
      "com.acme.shop.checkout.CheckoutActivity",
    ];
    const users = demoPathUsers(path);
    const network = demoNetwork({ path }, RootSpanMetricsQuantile.p50).results;

    expect(users).toBe(45_120);
    expect(network.map((e) => e.path_pattern)).toEqual([
      "/v1/cart",
      "/v1/cart/items/*",
      "/v1/promotions/validate",
    ]);
    expect(Math.max(...network.map((e) => e.users))).toBeLessThanOrEqual(users);
    expect(demoErrors({ path }).results.map((e) => e.method_name)).toEqual([
      "validatePromoCode",
    ]);
  });

  it("raises latencies at higher percentiles", () => {
    const selection = { node: "payment_submitted" };
    const p50 = demoNetwork(selection, RootSpanMetricsQuantile.p50).results;
    const p99 = demoNetwork(selection, RootSpanMetricsQuantile.p99).results;

    expect(p99[0].latency_ms).toBeGreaterThan(p50[0].latency_ms);
  });
});

describe("demoJourney", () => {
  it("links only nodes it has", () => {
    const ids = new Set(demoJourney.nodes.map((n) => n.id));

    for (const link of demoJourney.links) {
      expect(ids).toContain(link.source);
      expect(ids).toContain(link.target);
    }
  });
});
