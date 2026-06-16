/**
 * Generates JSON Schemas from the zod config schemas so editors can validate and
 * autocomplete the config files. Run via `npm run gen:schema`.
 *   - schema.json      → morph.json settings (MorphFileSchema)
 *   - mcp.schema.json  → .mcp.json servers (McpFileSchema)
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { McpFileSchema, MorphFileSchema } from '../src/config/schema.js';

function emit(schema: unknown, name: string, file: string): void {
  const json = zodToJsonSchema(schema as never, { name, $refStrategy: 'none' });
  const out = resolve(process.cwd(), file);
  writeFileSync(out, JSON.stringify(json, null, 2) + '\n');
  process.stderr.write(`wrote ${out}\n`);
}

emit(MorphFileSchema, 'MorphConfig', 'schema.json');
emit(McpFileSchema, 'McpConfig', 'mcp.schema.json');
