/**
 * Pins the docs theme switch to the app's own toggle: the fumadocs
 * themeSwitch slot must render the shared ThemeToggle so docs theming
 * matches the dashboard and marketing pages, and it must keep the
 * className fumadocs passes (ms-auto aligns it in the sidebar footer).
 */
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockSetTheme = jest.fn();

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}));

jest.mock("lucide-react", () => ({
  Sun: () => <span data-testid="sun-icon" />,
  Moon: () => <span data-testid="moon-icon" />,
}));

jest.mock("@/app/components/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import DocsThemeSwitch from "@/app/docs/components/docs_theme_switch";

describe("DocsThemeSwitch", () => {
  it("renders the app theme toggle", () => {
    render(<DocsThemeSwitch />);
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument();
  });

  it("keeps the className fumadocs passes on the wrapper", () => {
    const { container } = render(<DocsThemeSwitch className="ms-auto" />);
    expect(container.firstChild).toHaveClass("ms-auto");
  });

  it("switches the theme on click", () => {
    render(<DocsThemeSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
