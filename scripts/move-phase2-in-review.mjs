import { execSync } from "child_process";

const GH_EXE = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;
const PROJECT_ID = "PVT_kwHOCGDCW84Bl1rJ";
const STATUS_FIELD_ID = "PVTSSF_lAHOCGDCW84Bl1rJzhkg7WA";
const IN_REVIEW_ID = "df73e18b";

const items = [
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARSzs", num: 36, title: "taste compatibility score" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARS1U", num: 37, title: "shared books and overlap filters" },
  { id: "PVTI_lAHOCGDCW84Bl1rJzhARS3Y", num: 38, title: "direct friend recommendations" },
];

for (const item of items) {
  console.log(`Moving Issue #${item.num} (${item.title}) to In review...`);
  execSync(`${GH_EXE} project item-edit --id "${item.id}" --project-id "${PROJECT_ID}" --field-id "${STATUS_FIELD_ID}" --single-select-option-id "${IN_REVIEW_ID}"`);
}

console.log("Phase 2 items successfully moved to In review!");
