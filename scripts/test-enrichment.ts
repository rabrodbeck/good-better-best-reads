import { enrichBookDetails } from "../services/books/enrichment-service";

async function run() {
  console.log("🎨 Testing Open Library Lazy Book Enrichment...\n");

  const testBooks = [
    { title: "Credence", author: "Penelope Douglas", isbn: "9781660089055" },
    { title: "Project Hail Mary", author: "Andy Weir", isbn: "9780593135204" },
    { title: "Clusterf*ck", author: "Brian O'Sullivan", isbn: null },
  ];

  for (const book of testBooks) {
    console.log(`Searching Open Library for: "${book.title}" by ${book.author}...`);
    const details = await enrichBookDetails(book.title, book.author, book.isbn);

    if (details) {
      console.log(`✅ Found: "${details.title}" by ${details.author}`);
      console.log(`   📸 Cover URL:      ${details.coverUrl || "No cover found"}`);
      console.log(`   🏷️  Genres:         ${details.genres.join(", ") || "None"}`);
      console.log(`   📄 Pages:          ${details.pageCount || "Unknown"}`);
      console.log(`   📅 Published Year: ${details.publishedYear || "Unknown"}\n`);
    } else {
      console.log(`❌ No match found on Open Library for "${book.title}"\n`);
    }
  }
}

run().catch(console.error);