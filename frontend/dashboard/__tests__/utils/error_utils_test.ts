import { errorGroupPath, errorGroupTitle } from "@/app/utils/error_utils";
import { describe, expect, it } from "@jest/globals";

describe("errorGroupTitle", () => {
  it("joins the file and method and adds parentheses to the method", () => {
    expect(errorGroupTitle("Repo.kt", "load")).toBe("Repo.kt: load()");
  });

  it("keeps a method that already ends with its parameter list", () => {
    expect(errorGroupTitle("Repo.kt", "load(int)")).toBe("Repo.kt: load(int)");
  });

  it("keeps an Objective-C method that ends with a bracket", () => {
    expect(errorGroupTitle("Cart.m", "-[Cart checkout]")).toBe(
      "Cart.m: -[Cart checkout]",
    );
  });

  it("names a missing file and method as unknown", () => {
    expect(errorGroupTitle("", "")).toBe("unknown_file: unknown_method()");
    expect(errorGroupTitle("", "load")).toBe("unknown_file: load()");
    expect(errorGroupTitle("Repo.kt", "")).toBe("Repo.kt: unknown_method()");
  });
});

describe("errorGroupPath", () => {
  const group = {
    id: "group-1",
    type: "java.lang.RuntimeException",
    file_name: "Repo.kt",
  };

  it("links to the group under the team and app with type@file as its name", () => {
    expect(errorGroupPath("team-1", "app-1", group)).toBe(
      "/team-1/errors/app-1/group-1/java.lang.RuntimeException%40Repo.kt",
    );
  });

  it("uses the file alone when the group has no type", () => {
    expect(errorGroupPath("team-1", "app-1", { ...group, type: "" })).toBe(
      "/team-1/errors/app-1/group-1/Repo.kt",
    );
  });

  it("uses the type alone when the group has no file name", () => {
    expect(errorGroupPath("team-1", "app-1", { ...group, file_name: "" })).toBe(
      "/team-1/errors/app-1/group-1/java.lang.RuntimeException",
    );
  });

  it("uses unknown_file when the group has no type and no file name", () => {
    expect(
      errorGroupPath("team-1", "app-1", { ...group, type: "", file_name: "" }),
    ).toBe("/team-1/errors/app-1/group-1/unknown_file");
  });

  it("encodes the name so it stays one path segment", () => {
    expect(
      errorGroupPath("team-1", "app-1", {
        ...group,
        type: "",
        file_name: "src/My File.kt",
      }),
    ).toBe("/team-1/errors/app-1/group-1/src%2FMy%20File.kt");
  });
});
