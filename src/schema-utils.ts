/**
 * Konverterar Zod-scheman i verktygsdefinitioner till JSON Schema.
 *
 * Verktygens inputSchema.properties pekar på Zod-shapes (t.ex. searchSubjectsSchema) eller
 * z.object(...). Skickas de rakt ut serialiseras Zods interna fält (_def, ~standard) i stället
 * för ett giltigt JSON Schema, och strikta MCP-klienter avvisar då hela tools/list.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

interface ToolInputSchema {
  type: "object";
  properties?: unknown;
  required?: string[];
  [key: string]: unknown;
}

interface ToolDefinition {
  name: string;
  inputSchema: ToolInputSchema;
  [key: string]: unknown;
}

const isZod = (value: unknown): value is z.ZodTypeAny =>
  value instanceof z.ZodType;

/**
 * En fristående .optional() blir `anyOf: [{ not: {} }, X]` ("undefined eller X"). Valfrihet
 * uttrycks redan via `required`, så vi plattar ut till X (behåller description/default).
 */
function dropUndefinedBranch(
  json: Record<string, unknown>,
): Record<string, unknown> {
  const anyOf = json.anyOf as Record<string, unknown>[] | undefined;
  if (!Array.isArray(anyOf)) return json;
  const rest = anyOf.filter(
    (s) =>
      !(
        s &&
        typeof s.not === "object" &&
        Object.keys(s.not as object).length === 0
      ),
  );
  if (rest.length !== 1 || rest.length === anyOf.length) return json;
  const { anyOf: _anyOf, ...outer } = json;
  return { ...dropUndefinedBranch(rest[0]), ...outer };
}

function propertyToJsonSchema(value: z.ZodTypeAny): Record<string, unknown> {
  const { $schema, ...json } = zodToJsonSchema(value, {
    $refStrategy: "none",
  }) as Record<string, unknown>;
  return dropUndefinedBranch(json);
}

export function toJsonInputSchema(
  inputSchema: ToolInputSchema,
): ToolInputSchema {
  let shape = inputSchema.properties;
  if (shape instanceof z.ZodObject) shape = shape.shape;
  if (!shape || typeof shape !== "object") return inputSchema;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape as Record<string, unknown>)) {
    if (isZod(value)) {
      properties[key] = propertyToJsonSchema(value);
      if (!value.isOptional()) required.push(key);
    } else {
      properties[key] = value;
    }
  }

  const explicitRequired =
    inputSchema.required ?? (required.length ? required : undefined);
  return {
    ...inputSchema,
    properties,
    ...(explicitRequired ? { required: explicitRequired } : {}),
  };
}

export function normalizeTools<T extends ToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => ({
    ...tool,
    inputSchema: toJsonInputSchema(tool.inputSchema),
  }));
}
