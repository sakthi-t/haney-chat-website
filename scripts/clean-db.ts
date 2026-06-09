import { db, schema } from "../lib/db";

async function cleanDatabase() {
  console.log("🗑️  Cleaning database...\n");

  // Order matters — respect foreign keys
  console.log("  Deleting messages...");
  const deletedMessages = await db.delete(schema.messages).execute();
  console.log(`  ✓ ${deletedMessages.length} messages deleted`);

  console.log("  Deleting conversations...");
  const deletedConversations = await db.delete(schema.conversations).execute();
  console.log(`  ✓ ${deletedConversations.length} conversations deleted`);

  console.log("  Deleting user_settings...");
  const deletedSettings = await db.delete(schema.userSettings).execute();
  console.log(`  ✓ ${deletedSettings.length} settings deleted`);

  console.log("  Deleting users...");
  const deletedUsers = await db.delete(schema.users).execute();
  console.log(`  ✓ ${deletedUsers.length} users deleted`);

  console.log("\n✅ Database cleaned successfully!");
  process.exit(0);
}

cleanDatabase().catch((err) => {
  console.error("❌ Failed to clean database:", err);
  process.exit(1);
});
