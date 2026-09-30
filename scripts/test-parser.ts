import * as fs from "fs";
import * as path from "path";
import { parseGoodreadsCsv } from "../services/parser/goodreads-normalizer";

async function run() {
  console.log("🔍 Testing Goodreads CSV Normalizer...\n");

  const filePath = path.resolve(process.cwd(), "test/fixtures/goodreads_library_export_ryan.csv");

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found at: ${filePath}`);
    process.exit(1);
  }

  const csvData = fs.readFileSync(filePath, "utf-8");
  const result = parseGoodreadsCsv(csvData);

  console.log("=========================================");
  console.log("       PARSE & INGESTION STATS           ");
  console.log("=========================================");
  console.log(`📚 Total Books Parsed:     ${result.stats.totalParsed}`);
  console.log(`✅ Read Books:             ${result.stats.readCount}`);
  console.log(`📖 Currently Reading:      ${result.stats.currentlyReadingCount}`);
  console.log(`🔖 Want to Read:           ${result.stats.toReadCount}`);
  console.log(`🛑 Did Not Finish (DNF):   ${result.stats.dnfCount}`);
  console.log(`⭐ 5-Star Favorites:       ${result.stats.fiveStarCount}`);
  console.log(`👎 1-Star Dislikes:        ${result.stats.oneStarCount}`);
  console.log(`⚪ Unrated:                ${result.stats.unratedCount}`);
  console.log(`⚠️  Parse Warnings/Errors:  ${result.errors.length}`);
  console.log("=========================================\n");

  if (result.books.length > 0) {
    console.log("Top 3 Sample Normalized Books:");
    result.books.slice(0, 3).forEach((book, i) => {
      console.log(`\n[${i + 1}] "${book.cleanTitle}" by ${book.author}`);
      if (book.series) console.log(`    Series: ${book.series}`);
      console.log(`    Shelf: ${book.shelf} | Rating: ${book.myRating}★ | ISBN13: ${book.isbn13}`);
    });
  }
}

run().catch(console.error);