import { packJsonSchema } from "./schema.js";
import { growthPresets, examplePack, contractNotes } from "./templates.js";
import { starterConfig, starterBlueprints } from "./starter.js";
export function authoringGuide() {
  return {
    schema: packJsonSchema,
    presets: growthPresets,
    example: examplePack,
    notes: contractNotes,
    capabilities: { localExecution: true, cloudRelay: true },
    starter: { ...starterConfig, blueprints: starterBlueprints() },
  };
}
