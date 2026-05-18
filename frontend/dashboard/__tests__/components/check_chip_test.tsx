import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import { CheckChip, CheckChipGroup } from "@/app/components/check_chip";

describe("CheckChip", () => {
  it("renders its label", () => {
    render(<CheckChip label="Android" selected={false} onToggle={() => {}} />);
    expect(screen.getByText("Android")).toBeInTheDocument();
  });

  it("exposes the unselected state via aria-checked", () => {
    render(<CheckChip label="Android" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("exposes the selected state via aria-checked", () => {
    render(<CheckChip label="Android" selected={true} onToggle={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onToggle when clicked", () => {
    const onToggle = jest.fn();
    render(<CheckChip label="Android" selected={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("CheckChipGroup", () => {
  const countries = ["US", "IN", "GB"];

  function stringProps(
    selected: string[],
    onChange: (s: string[]) => void = () => {},
  ) {
    return {
      items: countries,
      selected,
      getLabel: (item: string) => item,
      isEqual: (a: string, b: string) => a === b,
      onChange,
    };
  }

  it("renders a chip for every item", () => {
    render(<CheckChipGroup {...stringProps([])} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("IN")).toBeInTheDocument();
    expect(screen.getByText("GB")).toBeInTheDocument();
  });

  it("marks only the selected items as checked", () => {
    render(<CheckChipGroup {...stringProps(["IN"])} />);
    expect(screen.getByText("US")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("IN")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("GB")).toHaveAttribute("aria-checked", "false");
  });

  it("adds an item to the selection when an unselected chip is clicked", () => {
    const onChange = jest.fn();
    render(<CheckChipGroup {...stringProps(["US"], onChange)} />);
    fireEvent.click(screen.getByText("IN"));
    expect(onChange).toHaveBeenCalledWith(["US", "IN"]);
  });

  it("removes an item from the selection when a selected chip is clicked", () => {
    const onChange = jest.fn();
    render(<CheckChipGroup {...stringProps(["US", "IN"], onChange)} />);
    fireEvent.click(screen.getByText("US"));
    expect(onChange).toHaveBeenCalledWith(["IN"]);
  });

  it("renders nothing when there are no items", () => {
    render(<CheckChipGroup {...stringProps([])} items={[]} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("supports object items via getLabel and isEqual", () => {
    type OsVersion = { displayName: string };
    const osVersions: OsVersion[] = [
      { displayName: "Android 13" },
      { displayName: "Android 14" },
    ];
    const onChange = jest.fn();
    render(
      <CheckChipGroup
        items={osVersions}
        selected={[osVersions[0]]}
        getLabel={(o) => o.displayName}
        isEqual={(a, b) => a.displayName === b.displayName}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Android 13")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("Android 14")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fireEvent.click(screen.getByText("Android 14"));
    expect(onChange).toHaveBeenCalledWith([osVersions[0], osVersions[1]]);
  });
});
