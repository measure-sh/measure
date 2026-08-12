import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  DropdownSelectType: { SingleString: "SingleString" },
  default: ({ items, initialSelected, onChangeSelected }: any) => (
    <div data-testid="app-dropdown" data-selected={initialSelected}>
      {items.map((item: string) => (
        <button
          key={item}
          data-testid={`app-${item}`}
          onClick={() => onChangeSelected(item)}
        >
          {item}
        </button>
      ))}
      <button
        data-testid="app-gone"
        onClick={() => onChangeSelected("An app the team no longer has")}
      >
        gone
      </button>
    </div>
  ),
}));

import type { App } from "@/app/api/api_calls";
import AppSelect from "@/app/components/filter_bar/app_select";

const app = (id: string, name: string) => ({ id, name }) as App;

const apps = [app("app-1", "Checkout"), app("app-2", "Wallet")];

describe("AppSelect", () => {
  it("offers every app the team has", () => {
    render(<AppSelect apps={apps} selected={apps[0]} onChange={jest.fn()} />);

    expect(screen.getByTestId("app-Checkout")).toBeInTheDocument();
    expect(screen.getByTestId("app-Wallet")).toBeInTheDocument();
  });

  it("shows the app it was given", () => {
    render(<AppSelect apps={apps} selected={apps[1]} onChange={jest.fn()} />);

    expect(screen.getByTestId("app-dropdown")).toHaveAttribute(
      "data-selected",
      "Wallet",
    );
  });

  it("reports the app behind the name that was picked", () => {
    const onChange = jest.fn();
    render(<AppSelect apps={apps} selected={apps[0]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("app-Wallet"));

    expect(onChange).toHaveBeenCalledWith(apps[1]);
  });

  it("reports nothing when the app picked is the one showing", () => {
    const onChange = jest.fn();
    render(<AppSelect apps={apps} selected={apps[0]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("app-Checkout"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports nothing for a name no app goes by", () => {
    const onChange = jest.fn();
    render(<AppSelect apps={apps} selected={apps[0]} onChange={onChange} />);

    fireEvent.click(screen.getByTestId("app-gone"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
