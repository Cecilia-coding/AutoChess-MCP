import { z } from "zod";
import { unitSchema, packSchema } from "../core/schema.js";
import { starterSchema } from "../core/starter.js";
import { actionSchema } from "../play/match.js";
const label = z.string().max(200);
const finite = z.number().finite();
const piece = z.strictObject({
  id: label,
  unitId: label,
  name: label,
  star: z.number().int().min(1).max(3),
  row: z.number().nullable(),
  col: z.number().nullable(),
  health: finite,
  attack: finite,
});
const offer = z
  .strictObject({ unitId: label, name: label, cost: z.number().int().min(1).max(5) })
  .nullable();
export const summarySchema = z.strictObject({
  phase: z.enum(["editor", "trial"]),
  revision: z.number().int().nonnegative(),
  title: label,
  unitCount: z.number().int().nonnegative(),
  catalogOffset: z.number().int().nonnegative().optional(),
  catalog: z
    .array(z.strictObject({ id: label, name: label, cost: z.number().int().min(1).max(5) }))
    .max(100)
    .optional(),
  selectedUnit: unitSchema.optional(),
  growth: packSchema.shape.rules.shape.starGrowth.optional(),
  trial: z
    .strictObject({
      id: z.string().uuid(),
      round: z.number().int().positive(),
      phase: z.enum(["prepare", "finished"]),
      result: z.enum(["win", "loss", "draw"]).optional(),
      health: finite,
      opponentHealth: finite,
      gold: finite,
      level: z.number().int(),
      xp: finite,
      shop: z.array(offer).max(5),
      pieces: z.array(piece).max(17),
      battle: z
        .strictObject({
          outcome: z.enum(["left", "right", "draw"]),
          durationMs: finite,
          events: z.array(z.strictObject({ timeMs: finite, text: z.string().max(500) })).max(12),
        })
        .optional(),
    })
    .optional(),
});
export const editSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("prepare"), options: starterSchema }),
  z.strictObject({
    type: z.literal("metadata"),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
  z.strictObject({ type: z.literal("growth"), growth: packSchema.shape.rules.shape.starGrowth }),
  z.strictObject({ type: z.literal("put_unit"), unit: unitSchema }),
  z.strictObject({ type: z.literal("remove_unit"), unitId: label }),
  z.strictObject({ type: z.literal("select_unit"), unitId: label }),
  z.strictObject({ type: z.literal("catalog_page"), offset: z.number().int().nonnegative() }),
]);
export const commandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("edit"), action: editSchema }),
  z.strictObject({ kind: z.literal("play"), action: actionSchema }),
  z.strictObject({ kind: z.literal("start_trial") }),
  z.strictObject({ kind: z.literal("inspect_unit"), unitId: label }),
]);
export const envelopeSchema = z.strictObject({
  requestId: z.string().min(8).max(100),
  expectedRevision: z.number().int().nonnegative(),
  command: commandSchema,
});
export type RelaySummary = z.infer<typeof summarySchema>;
export type RelayEnvelope = z.infer<typeof envelopeSchema>;
