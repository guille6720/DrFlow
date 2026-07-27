import fs from "fs";
import readline from "readline";

const path = process.argv[2] ?? "c:/Users/pigus/Downloads/teams-6dac9267.jsonl";

const typeCounts: Record<string, number> = {};
let recordsWithText = 0;
let longEvo = 0;
let shortEvo = 0;

async function main() {
  await new Promise<void>((resolve) => {
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { encoding: "utf8" }),
  });
  rl.on("line", (line) => {
    if (!line.includes('"id":"records/')) return;
    try {
      const o = JSON.parse(line) as {
        type?: string;
        text?: string;
        content?: string;
      };
      const t = o.type ?? "unknown";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      const raw = (o.text ?? o.content ?? "").replace(/<[^>]+>/g, " ");
      if (raw.length > 30) recordsWithText += 1;
      if (t === "records") {
        if (raw.length > 80) longEvo += 1;
        else shortEvo += 1;
      }
    } catch {
      /* skip */
    }
  });
  rl.on("close", () => resolve());
});

  const consumersWithRecords = new Set<string>();
  let consumerLines = 0;

  await new Promise<void>((resolve) => {
    const rl2 = readline.createInterface({
      input: fs.createReadStream(path, { encoding: "utf8" }),
    });
    rl2.on("line", (line) => {
      if (line.includes('"id":"consumers/')) consumerLines += 1;
      if (!line.includes('"id":"records/')) return;
      try {
        const o = JSON.parse(line) as {
          consumers?: { id: string }[];
        };
        for (const c of o.consumers ?? []) {
          if (c.id) consumersWithRecords.add(c.id);
        }
      } catch {
        /* skip */
      }
    });
    rl2.on("close", () => resolve());
  });

  console.log(
    JSON.stringify(
      {
        typeCounts,
        recordsWithText,
        longEvo,
        shortEvo,
        consumerLines,
        consumersWithClinicalRecords: consumersWithRecords.size,
      },
      null,
      2
    )
  );
}

main();
