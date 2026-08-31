// Loads sample data showing multi-committee support: one admin who owns two
// separate committees, each with their own members, payments, and loans.
// Run with: npm run seed
require("dotenv").config();
const connectDB = require("./config/db");
const Admin = require("./models/Admin");
const Committee = require("./models/Committee");
const Member = require("./models/Member");
const Payment = require("./models/Payment");
const Loan = require("./models/Loan");

const azadMohallaMembers = [
  { name: "Azeem Ansari", phone: "9000000001", pin: "1111" },
  { name: "Afsar Ansari", phone: "9000000002", pin: "1112" },
  { name: "Nashad Alam", phone: "9000000003", pin: "1113" },
  { name: "Meraj Ansari", phone: "9000000004", pin: "1114" },
  { name: "Taslim Ansari", phone: "9000000005", pin: "1115" },
  { name: "Naim Ansari", phone: "9000000006", pin: "1116" },
  { name: "Imtiyaz Ansari", phone: "9000000007", pin: "1117" },
  { name: "Adil Ansari", phone: "9000000008", pin: "1118" },
  { name: "Shahid Ansari", phone: "9000000009", pin: "1119" },
  { name: "Mumtaz Ansari", phone: "9000000010", pin: "1120" },
  { name: "Faizan Ansari", phone: "9000000011", pin: "1121" },
  { name: "Seraj Uddin", phone: "9000000012", pin: "1122" },
  { name: "Saddam Ansari", phone: "9000000013", pin: "1123" },
  { name: "Subahani", phone: "9000000014", pin: "1124" },
];

const azadMohallaRules = [
  { hi: "नॉर्मल 10 से 20 हज़ार तक खर्च में 5 से 10 हज़ार मिलेगा, टाइम 2 महीना मिलेगा", en: "Normal need (Rs 10k-20k): loan of Rs 5k-10k, repay within 2 months" },
  { hi: "50 हज़ार खर्च में 20 हज़ार तक मिलेगा, टाइम 3 महीना मिलेगा", en: "For Rs 50k need: up to Rs 20k loan, repay within 3 months" },
  { hi: "1 लाख तक खर्च में 40 हज़ार तक मिलेगा, टाइम 5 महीना मिलेगा", en: "For need up to Rs 1 lakh: up to Rs 40k loan, repay within 5 months" },
  { hi: "बेटी की शादी में 40 हज़ार तक मिलेगा, टाइम 5 से 6 महीने तक मिलेगा", en: "For a daughter's wedding: up to Rs 40k loan, repay within 5-6 months" },
  { hi: "जितने मेंबर हैं सभी मेंबर बेटी की शादी में 5000 करके देंगे", en: "Every member contributes Rs 5,000 toward a member's daughter's wedding" },
];

const officeCommitteeMembers = [
  { name: "Ravi Kumar", phone: "8000000001", pin: "2111" },
  { name: "Priya Sharma", phone: "8000000002", pin: "2112" },
  { name: "Amit Verma", phone: "8000000003", pin: "2113" },
];

async function seedCommittee({ ownerId, name, code, monthlyDefault, rules, members, includeLoans }) {
  const committee = await Committee.create({ name, code, owner: ownerId, monthlyDefault, rules });

  const createdMembers = [];
  for (const m of members) {
    const member = await Member.create({ committee: committee._id, ...m, monthlyAmount: monthlyDefault });
    createdMembers.push(member);
  }

  const paymentDocs = [];
  for (const m of createdMembers) {
    for (let month = 0; month <= 7; month++) {
      paymentDocs.push({ committee: committee._id, member: m._id, year: 2026, month, amount: monthlyDefault });
    }
  }
  await Payment.insertMany(paymentDocs);

  if (includeLoans && createdMembers.length >= 2) {
    await Loan.insertMany([
      {
        committee: committee._id,
        member: createdMembers[5]?._id || createdMembers[0]._id,
        amount: 50000,
        purpose: "Personal need",
        givenDate: "2026-06-06",
        dueDate: "2027-02-28",
      },
      {
        committee: committee._id,
        member: createdMembers[11]?._id || createdMembers[1]._id,
        amount: 7000,
        purpose: "Daughter's wedding",
        givenDate: "2026-07-24",
        dueDate: "2026-10-30",
      },
    ]);
  }

  return { committee, members: createdMembers };
}

async function run() {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([
    Admin.deleteMany(),
    Committee.deleteMany(),
    Member.deleteMany(),
    Payment.deleteMany(),
    Loan.deleteMany(),
  ]);

  console.log("Creating admin...");
  const admin = await Admin.create({
    name: process.env.ADMIN_NAME || "Admin",
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD || "azad123",
  });

  console.log("Creating committee 1 — Azad Mohalla Samiti...");
  const c1 = await seedCommittee({
    ownerId: admin._id,
    name: "Azad Mohalla Samiti",
    code: "AZAD01",
    monthlyDefault: 300,
    rules: azadMohallaRules,
    members: azadMohallaMembers,
    includeLoans: true,
  });

  console.log("Creating committee 2 — Office Bachat Samiti (proves one admin can own more than one committee)...");
  const c2 = await seedCommittee({
    ownerId: admin._id,
    name: "Office Bachat Samiti",
    code: "OFFICE1",
    monthlyDefault: 500,
    rules: [{ hi: "हर महीने 500 रुपये जमा करना अनिवार्य है", en: "Rs 500 monthly contribution is mandatory" }],
    members: officeCommitteeMembers,
    includeLoans: false,
  });

  console.log("\nSeed complete.\n");
  console.log("Admin login:");
  console.log(`  email:    ${process.env.ADMIN_EMAIL || "admin@example.com"}`);
  console.log(`  password: ${process.env.ADMIN_PASSWORD || "azad123"}`);
  console.log("\nCommittee 1 — Azad Mohalla Samiti");
  console.log(`  join code: ${c1.committee.code}`);
  console.log("  sample member login -> phone: 9000000006 (Naim Ansari), pin: 1116");
  console.log("\nCommittee 2 — Office Bachat Samiti");
  console.log(`  join code: ${c2.committee.code}`);
  console.log("  sample member login -> phone: 8000000001 (Ravi Kumar), pin: 2111");
  console.log("\nBoth committees are owned by the same admin — log in as admin, then");
  console.log("GET /api/committees to see both, and switch :committeeId per request.");

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
