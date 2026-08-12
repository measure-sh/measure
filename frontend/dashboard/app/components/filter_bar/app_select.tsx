"use client";

import { type App } from "../../api/api_calls";
import DropdownSelect, { DropdownSelectType } from "../dropdown_select";

export default function AppSelect({
  apps,
  selected,
  onChange,
}: {
  apps: App[];
  selected: App;
  onChange: (app: App) => void;
}) {
  return (
    <DropdownSelect
      title="App Name"
      type={DropdownSelectType.SingleString}
      items={apps.map((app: App) => app.name)}
      initialSelected={selected.name}
      onChangeSelected={(item) => {
        const app = apps.find((a: App) => a.name === item);
        if (!app || app.id === selected.id) {
          return;
        }
        onChange(app);
      }}
    />
  );
}
