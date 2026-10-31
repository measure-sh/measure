import Turnstile, { type TurnstileHandle } from "@/app/components/turnstile";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import { createRef } from "react";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({ onReady }: any) => {
    const React = require("react");
    React.useEffect(() => onReady?.(), [onReady]);
    return null;
  },
}));

let renderOptions: any;
const mockRender = jest.fn((_el: HTMLElement, options: any) => {
  renderOptions = options;
  return "widget-1";
});
const mockReset = jest.fn();
const mockRemove = jest.fn();

describe("Turnstile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderOptions = undefined;
    window.turnstile = {
      render: mockRender,
      reset: mockReset,
      remove: mockRemove,
    };
  });

  it("renders Cloudflare's widget once and passes its tokens on", () => {
    const onToken = jest.fn();
    render(<Turnstile siteKey="site-key" onToken={onToken} />);

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(renderOptions.sitekey).toBe("site-key");

    act(() => renderOptions.callback("tok"));
    expect(onToken).toHaveBeenLastCalledWith("tok");

    act(() => renderOptions["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("tells the form when Cloudflare shows the checkbox", () => {
    const onCheckShown = jest.fn();
    render(
      <Turnstile
        siteKey="site-key"
        onToken={jest.fn()}
        onCheckShown={onCheckShown}
      />,
    );

    act(() => renderOptions["before-interactive-callback"]());

    expect(onCheckShown).toHaveBeenCalledTimes(1);
  });

  it("drops the used token and asks for a fresh one on reset", () => {
    const onToken = jest.fn();
    const ref = createRef<TurnstileHandle>();
    render(<Turnstile ref={ref} siteKey="site-key" onToken={onToken} />);

    act(() => ref.current?.reset());

    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(mockReset).toHaveBeenCalledWith("widget-1");
  });

  it("removes the widget when it unmounts", () => {
    const { unmount } = render(
      <Turnstile siteKey="site-key" onToken={jest.fn()} />,
    );

    unmount();

    expect(mockRemove).toHaveBeenCalledWith("widget-1");
  });
});
