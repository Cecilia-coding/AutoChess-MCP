import { authoringGuide } from "../core/guide.js";
import { inspectPack, prepareStarter } from "../core/index.js";
import { createTrial, actTrial, viewTrial } from "../play/match.js";
import { summarySchema } from "../relay/protocol.js";

self.onmessage = ({ data: { id, operation, input } }) => {
  try {
    let value: unknown;
    if (operation === "guide") value = authoringGuide();
    else if (operation === "preview") value = inspectPack(input);
    else if (operation === "starter") value = inspectPack(prepareStarter(input));
    else if (operation === "start")
      value = viewTrial(createTrial(input.id, input.pack, input.seed));
    else if (operation === "act") value = viewTrial(actTrial(input.match, input.action));
    else if (operation === "view") value = viewTrial(input);
    else if (operation === "summary") {
      const projection = { ...input };
      for (const key of ["selectedUnit", "growth", "catalog"] as const) {
        if (!summarySchema.shape[key].safeParse(projection[key]).success) delete projection[key];
      }
      value = summarySchema.parse(projection);
    } else throw new Error("未知本地操作");
    self.postMessage({ id, value });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "本地计算失败" });
  }
};
