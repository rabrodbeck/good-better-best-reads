import { execSync } from "child_process";

const GH_EXE = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;
const PROJECT_ID = "PVT_kwHOCGDCW84Bl1rJ";
const STATUS_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7WA";
const STATUS_OPTIONS = {
  Backlog: "f75ad846",
  Ready: "61e4505c",
  InProgress: "47fc9ee4",
  InReview: "df73e18b",
  Done: "98236657",
};

const PRIORITY_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7yg";
const PRIORITY_OPTIONS = {
  P0: "79628723",
  P1: "0a877460",
  P2: "da944a9c",
};

const SIZE_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7yk";
const SIZE_OPTIONS = {
  XS: "6c6483d2",
  S: "f784b110",
  M: "7515a9f1",
  L: "817d0097",
  XL: "db339eb2",
};

// Target configurations for issues 32-45
const CONFIGS = {
  32: { status: "Done", priority: "P0", size: "M" },
  33: { status: "Done", priority: "P0", size: "M" },
  34: { status: "Done", priority: "P1", size: "S" },
  35: { status: "Done", priority: "P1", size: "S" },
  36: { status: "Done", priority: "P1", size: "M" },
  37: { status: "Done", priority: "P1", size: "M" },
  38: { status: "Done", priority: "P2", size: "M" },
  39: { status: "InReview", priority: "P1", size: "M" },
  40: { status: "InReview", priority: "P2", size: "L" },
  41: { status: "Backlog", priority: "P2", size: "M" },
  42: { status: "Backlog", priority: "P2", size: "L" },
  43: { status: "Backlog", priority: "P2", size: "M" },
  44: { status: "Backlog", priority: "P2", size: "S" },
  45: { status: "Backlog", priority: "P2", size: "L" },
};

const output = execSync(`${GH_EXE} project item-list 1 --owner rabrodbeck --limit 100 --format json`, { encoding: "utf-8" });
const data = JSON.parse(output);

console.log(`Total project items: ${data.items.length}`);

for (const item of data.items) {
  const num = item.content?.number;
  if (num && CONFIGS[num]) {
    const cfg = CONFIGS[num];
    console.log(`\nConfiguring Issue #${num} (${item.title}) - Item ID: ${item.id}`);

    if (item.status !== cfg.status) {
      console.log(`  Updating status: ${item.status || "None"} -> ${cfg.status}`);
      execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${STATUS_FIELD_ID}" --single-select-option-id "${STATUS_OPTIONS[cfg.status]}"`);
    } else {
      console.log(`  Status already ${cfg.status}`);
    }

    if (item.priority !== cfg.priority) {
      console.log(`  Updating priority: ${item.priority || "None"} -> ${cfg.priority}`);
      execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${PRIORITY_FIELD_ID}" --single-select-option-id "${PRIORITY_OPTIONS[cfg.priority]}"`);
    } else {
      console.log(`  Priority already ${cfg.priority}`);
    }

    if (item.size !== cfg.size) {
      console.log(`  Updating size: ${item.size || "None"} -> ${cfg.size}`);
      execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${SIZE_FIELD_ID}" --single-select-option-id "${SIZE_OPTIONS[cfg.size]}"`);
    } else {
      console.log(`  Size already ${cfg.size}`);
    }
  }
}

console.log("\nAll issues 32-45 verified and configured!");
