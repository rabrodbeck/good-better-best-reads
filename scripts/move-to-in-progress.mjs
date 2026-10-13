import { execSync } from "child_process";

const GH_EXE = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;
const PROJECT_ID = "PVT_kwHOCGDCW84Bl1rJ";
const STATUS_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7WA";
const IN_PROGRESS_ID = "47fc9ee4";

const items = [
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARSjs", num: 32, title: "multi-provider book search" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARSoQ", num: 33, title: "global quick-add modal" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARStI", num: 34, title: "live shelf transitions" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARSxg", num: 35, title: "interactive book card rating controls" },
];

for (const item of items) {
  console.log(`Moving Issue #${item.num} (${item.title}) to In progress...`);
  execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${STATUS_FIELD_ID}" --single-select-option-id "${IN_PROGRESS_ID}"`);
}

console.log("Phase 1 items successfully moved to In progress!");
