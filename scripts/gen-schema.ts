/**
 * Generates schema.json (JSON Schema) from the zod config schema so editors can
 * validate and autocomplete morph.json. Run via `npm run gen:schema`.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MorphConfigSchema } from '../src/config/schema.js';

const schema = zodToJsonSchema(MorphConfigSchema, { name: 'MorphConfig', $refStrategy: 'none' });
const out = resolve(process.cwd(), 'schema.json');
writeFileSync(out, JSON.stringify(schema, null, 2) + '\n');
process.stderr.write(`wrote ${out}\n`);
