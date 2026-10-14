import { execSync } from "child_process";

const GH_EXE = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;
const PROJECT_ID = "PVT_kwHOCGDCW84Bl1rJ";
const STATUS_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7WA";
const IN_PROGRESS_ID = "47fc9ee4";

const items = [
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARS70", num: 39, title: "What Should I Read Next shelf concierge" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARTAM", num: 40, title: "series grouping & reading order tracking" },
];

for (const item of items) {
  console.log(`Moving Issue #${item.num} (${item.title}) to In progress...`);
  execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${STATUS_FIELD_ID}" --single-select-option-id "${IN_PROGRESS_ID}"`);
}

console.log("Phase 3 items successfully moved to In progress!");
