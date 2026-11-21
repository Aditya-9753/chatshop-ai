require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User.model");
const tokenVault = require("../src/utils/tokenVault");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  tokenVault.encrypt("startup-key-check");
  await mongoose.connect(process.env.MONGODB_URI);

  let migrated = 0;
  const users = User.find({
    "whatsappConfig.accessToken": { $exists: true, $nin: ["", null] },
  })
    .select("_id whatsappConfig.accessToken")
    .cursor();

  for await (const user of users) {
    const token = user.whatsappConfig.accessToken;
    if (tokenVault.isEncrypted(token)) continue;
    const result = await User.updateOne(
      { _id: user._id, "whatsappConfig.accessToken": token },
      { $set: { "whatsappConfig.accessToken": tokenVault.encrypt(token) } },
    );
    migrated += result.modifiedCount;
  }
  console.info(`Encrypted ${migrated} WhatsApp token(s).`);
}

main()
  .catch((error) => {
    console.error("WhatsApp token migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
