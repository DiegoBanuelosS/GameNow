import "dotenv/config";
import { connectDb } from "../src/db.js";
import { User } from "../src/models/User.js";

const ok = await connectDb();
if (!ok) {
  console.error("no db");
  process.exit(1);
}

const filter = {
  $or: [{ failedLoginAttempts: { $gt: 0 } }, { lockUntil: { $ne: null } }],
};

const before = await User.find(filter).select("username email failedLoginAttempts lockUntil").lean();
console.log("affected", before.length);
for (const user of before) {
  console.log(
    "-",
    user.username || user.email,
    "attempts=" + (user.failedLoginAttempts || 0),
    "lock=" + (user.lockUntil || "none"),
  );
}

const result = await User.updateMany(filter, {
  $set: { failedLoginAttempts: 0, lockUntil: null },
});
console.log("modified", result.modifiedCount);
process.exit(0);
