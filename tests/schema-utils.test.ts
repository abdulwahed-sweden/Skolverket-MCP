import { describe, it, expect } from "vitest";
import { z } from "zod";
import { normalizeTools, toJsonInputSchema } from "../src/schema-utils";
import {
  searchSubjectsSchema,
  getSubjectDetailsSchema,
} from "../src/tools/syllabus/subjects";
import { healthCheckSchema } from "../src/tools/health";

describe("toJsonInputSchema", () => {
  it("converts a Zod shape to JSON Schema properties without Zod internals", () => {
    const schema = toJsonInputSchema({
      type: "object",
      properties: searchSubjectsSchema,
    });
    const text = JSON.stringify(schema);
    expect(text).not.toContain("_def");
    expect(text).not.toContain("~standard");
    expect(schema.properties).toMatchObject({
      schooltype: { type: "string" },
      timespan: {
        type: "string",
        enum: ["LATEST", "FUTURE", "EXPIRED", "MODIFIED"],
        default: "LATEST",
      },
      limit: { type: "number", default: 50 },
    });
    expect(schema.required).toBeUndefined();
  });

  it("derives required fields from Zod when none are given", () => {
    const schema = toJsonInputSchema({
      type: "object",
      properties: getSubjectDetailsSchema,
    });
    expect(schema.required).toEqual(["code"]);
  });

  it("keeps an explicit required list", () => {
    const schema = toJsonInputSchema({
      type: "object",
      properties: { a: z.string(), b: z.string() },
      required: ["a"],
    });
    expect(schema.required).toEqual(["a"]);
  });

  it("unwraps a z.object() passed as properties", () => {
    const schema = toJsonInputSchema({
      type: "object",
      properties: healthCheckSchema,
    });
    expect(schema.properties).toMatchObject({
      includeApiTests: { type: "boolean" },
    });
  });

  it("leaves plain JSON Schema properties untouched", () => {
    const props = { q: { type: "string", description: "query" } };
    const [tool] = normalizeTools([
      { name: "t", inputSchema: { type: "object", properties: props } },
    ]);
    expect(tool.inputSchema.properties).toEqual(props);
  });
});
