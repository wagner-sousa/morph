import { describe, expect, it } from "vitest";
import { applyFieldSelection } from "../../src/projection/project.js";

describe("applyFieldSelection — include", () => {
  it("keeps only top-level fields", () => {
    const input = { id: 1, name: "a", secret: "x" };
    expect(
      applyFieldSelection(input, { mode: "include", fields: ["$.id", "$.name"] }),
    ).toEqual({ id: 1, name: "a" });
  });

  it("keeps nested JSONPath paths", () => {
    const input = { data: { id: 1, extra: "y" }, meta: "z" };
    expect(
      applyFieldSelection(input, { mode: "include", fields: ["$.data.id"] }),
    ).toEqual({ data: { id: 1 } });
  });

  it("traverses arrays element-wise", () => {
    const input = {
      tasks: [
        { id: 1, name: "a", big: "..." },
        { id: 2, name: "b", big: "..." },
      ],
    };
    expect(
      applyFieldSelection(input, {
        mode: "include",
        fields: ["$.tasks[*].id", "$.tasks[*].name"],
      }),
    ).toEqual({
      tasks: [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
      ],
    });
  });

  it("keeps the whole subtree when a parent path is selected", () => {
    const input = { data: { a: 1, b: 2 }, other: 3 };
    expect(
      applyFieldSelection(input, { mode: "include", fields: ["$.data"] }),
    ).toEqual({ data: { a: 1, b: 2 } });
  });

  it("omits non-existent paths", () => {
    const input = { id: 1 };
    expect(
      applyFieldSelection(input, { mode: "include", fields: ["$.id", "$.nope"] }),
    ).toEqual({ id: 1 });
  });

  it("does not throw on a malformed expression", () => {
    const input = { id: 1, name: "a" };
    expect(() =>
      applyFieldSelection(input, { mode: "include", fields: ["$.id", "$..[(@"] }),
    ).not.toThrow();
  });
});

describe("applyFieldSelection — exclude", () => {
  it("removes top-level fields", () => {
    const input = { id: 1, name: "a", secret: "x" };
    expect(
      applyFieldSelection(input, { mode: "exclude", fields: ["$.secret"] }),
    ).toEqual({ id: 1, name: "a" });
  });

  it("removes nested JSONPath paths", () => {
    const input = { data: { id: 1, secret: "x" } };
    expect(
      applyFieldSelection(input, { mode: "exclude", fields: ["$.data.secret"] }),
    ).toEqual({ data: { id: 1 } });
  });

  it("removes a field from each array element", () => {
    const input = {
      tasks: [
        { id: 1, big: "x" },
        { id: 2, big: "y" },
      ],
    };
    expect(
      applyFieldSelection(input, { mode: "exclude", fields: ["$.tasks[*].big"] }),
    ).toEqual({ tasks: [{ id: 1 }, { id: 2 }] });
  });

  it("removes whole array elements without leaving holes", () => {
    const input = { tasks: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    expect(
      applyFieldSelection(input, {
        mode: "exclude",
        fields: ["$.tasks[?(@.id==2)]"],
      }),
    ).toEqual({ tasks: [{ id: 1 }, { id: 3 }] });
  });

  it("is a no-op for non-existent paths", () => {
    const input = { id: 1, name: "a" };
    expect(
      applyFieldSelection(input, { mode: "exclude", fields: ["$.nope.deep"] }),
    ).toEqual({ id: 1, name: "a" });
  });

  it("does not mutate the input", () => {
    const input = { id: 1, secret: "x" };
    applyFieldSelection(input, { mode: "exclude", fields: ["$.secret"] });
    expect(input).toEqual({ id: 1, secret: "x" });
  });
});

describe("applyFieldSelection — edge cases", () => {
  it("passes through when no fields are given", () => {
    const input = { id: 1 };
    expect(applyFieldSelection(input, { mode: "include", fields: [] })).toBe(input);
  });
});
