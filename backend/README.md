# Committee Management API — Multi-Committee

A Node.js + Express + MongoDB backend where **any admin can create and run
multiple committees** (samitis) — each with its own members, monthly
payments, loans, and rules. Nothing is hardcoded to one committee anymore.

---

## 1. The mental model

- An **Admin** account can own any number of **Committees**.
- Each **Committee** has a unique join **code** (e.g. `AZAD01`) that members
  use to identify which committee they're logging into.
- **Members**, **Payments**, and **Loans** all belong to exactly one
  committee. The same phone number can exist in two different committees —
  a member's identity is really `(committee, phone)`, not phone alone.
- Every data route is nested under `/api/committees/:committeeId/...`, so
  the URL itself says which committee you're working with, and the backend
  checks that the logged-in admin actually owns that committee (or the
  logged-in member actually belongs to it) before returning anything.

```
committee-backend/
├── app.js
├── seed.js                    creates ONE admin who owns TWO committees
├── config/db.js
├── models/
│   ├── Admin.js
│   ├── Committee.js             NEW — name, join code, owner, rules
│   ├── Member.js                 now has a `committee` field
│   ├── Payment.js                now has a `committee` field
│   └── Loan.js                    now has a `committee` field
├── middleware/
│   ├── auth.js                  verifies JWT, restricts by role
│   ├── committeeAccess.js       NEW — loads :committeeId, checks ownership/membership
│   └── errorHandler.js
├── controllers/
│   ├── authController.js         admin login, member login (now needs a committee code)
│   ├── committeeController.js   NEW — create/list/update/delete committees
│   ├── memberController.js
│   ├── paymentController.js
│   ├── loanController.js
│   └── dashboardController.js
├── routes/
│   ├── authRoutes.js
│   ├── committeeRoutes.js       NEW — mounts member/payment/loan/dashboard routes nested inside it
│   ├── memberRoutes.js
│   ├── paymentRoutes.js
│   ├── loanRoutes.js
│   └── dashboardRoutes.js
└── postman_collection.json
```

---

## 2. Prerequisites

- Node.js 18+
- MongoDB — local (`mongod`) or a free [Atlas](https://www.mongodb.com/cloud/atlas/register) cluster
- Postman

---

## 3. Step-by-step setup

### Step 1 — Install
```bash
cd committee-backend
npm install
```

### Step 2 — Configure
```bash
cp .env.example .env
```
Fill in `MONGO_URI` and a random `JWT_SECRET`.

### Step 3 — Seed sample data
```bash
npm run seed
```
This creates **one admin** who owns **two separate committees**, to prove
multi-committee ownership actually works:

| Committee | Code | Sample member login |
|---|---|---|
| Azad Mohalla Samiti | `AZAD01` | phone `9000000006` (Naim Ansari), pin `1116` |
| Office Bachat Samiti | `OFFICE1` | phone `8000000001` (Ravi Kumar), pin `2111` |

The admin login (email/password) is printed to the console.

### Step 4 — Run
```bash
npm run dev
```

---

## 4. Testing in Postman

Import `postman_collection.json`. Folders run top to bottom:

1. **Auth** — Admin login saves `adminToken`. Member login needs a
   `committeeCode` (defaults to `AZAD01` in the collection variables) plus
   phone + pin, and saves `memberToken` + `memberId`.
2. **Committees** — `List my committees` auto-fills `committeeId` and
   `committeeCode` from the first committee returned. Try `Create a new
   committee` to see a fresh admin-owned committee appear with its own
   auto-generated code.
3. **Members / Payments / Loans / Dashboard** — all nested under
   `{{committeeId}}`. Every request here operates only within that one
   committee.
4. **Cross-committee access check** — swap `{{committeeId}}` to the *other*
   seeded committee's id while still using a token that doesn't belong to
   it, and resend. You should get `403 Forbidden` — this is the core
   guarantee of the multi-committee model: an admin can only touch
   committees they own, and a member can only touch the one they belong to.

To see two committees at once: run `Create a new committee` a second time,
note the new `committeeId`/`committeeCode` in the response, and repeat the
Members/Payments/Loans requests against it. Same admin token, completely
separate data.

---

## 5. Endpoint reference

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/admin/register` | public | create an admin account |
| POST | `/api/auth/admin/login` | public | admin login → JWT |
| POST | `/api/auth/member/login` | public | member login (committeeCode + phone + pin) → JWT |
| GET | `/api/auth/me` | logged in | current user's own profile |
| GET | `/api/committees/lookup/:code` | public | confirm a join code is real |
| POST | `/api/committees` | admin | create a new committee (auto-generates a code if none given) |
| GET | `/api/committees` | admin | list committees I own |
| GET | `/api/committees/:committeeId` | owner admin, or its member | committee details |
| PUT | `/api/committees/:committeeId` | owner admin | edit name, monthlyDefault, rules |
| DELETE | `/api/committees/:committeeId` | owner admin | delete committee + all its members/payments/loans |
| GET | `/api/committees/:id/members` | owner admin | list members in this committee |
| POST | `/api/committees/:id/members` | owner admin | add a member |
| GET | `/api/committees/:id/members/:memberId` | owner admin, or self | one member |
| PUT | `/api/committees/:id/members/:memberId` | owner admin | edit a member |
| DELETE | `/api/committees/:id/members/:memberId` | owner admin | remove a member |
| GET | `/api/committees/:id/payments?year=` | owner admin | all payments this committee |
| POST | `/api/committees/:id/payments` | owner admin | record/update a payment |
| GET | `/api/committees/:id/payments/member/:memberId` | owner admin, or self | one member's payments |
| PUT/DELETE | `/api/committees/:id/payments/:paymentId` | owner admin | edit/delete a payment |
| GET | `/api/committees/:id/loans?status=` | owner admin | all loans this committee |
| POST | `/api/committees/:id/loans` | owner admin | give a new loan |
| GET | `/api/committees/:id/loans/member/:memberId` | owner admin, or self | one member's loans |
| PUT/DELETE | `/api/committees/:id/loans/:loanId` | owner admin | update/delete a loan |
| GET | `/api/committees/:id/dashboard/summary` | owner admin, or its member | role-aware totals for that committee |

---

## 6. How access control works now

- Every committee-scoped route runs `loadCommittee` first, which fetches
  the `Committee` document named in the URL and 404s if it doesn't exist.
- `committeeAdminOnly` then checks the JWT's admin id against
  `committee.owner` — writes (create/edit/delete members, payments, loans,
  committee settings) always require this.
- `committeeAdminOrMember` allows the owning admin OR a member whose token
  was issued for this exact committee (the committee id is embedded in a
  member's JWT at login) — used for reads like the dashboard summary.
- Self-scoped reads (a member viewing their own payments/loans/profile)
  additionally check `req.user.id === req.params.memberId`, so a member
  token can never be used to read another member's data even within the
  same committee.
- Deleting a committee cascades: all of its members, payments, and loans
  are removed too. There's no undo, so a frontend should confirm this step.

---

## 7. Security features

- **Rate limiting** on all login/register endpoints — 8 attempts per 15
  minutes for member login (PINs are only 4 digits, so this matters most
  here), 15 for admin login, 5 per hour for admin registration.
- **Admin registration secret** — set `ADMIN_REGISTRATION_SECRET` in
  `.env` to a long random value, and only people who know it can create
  new admin accounts via `POST /api/auth/admin/register` (they must send
  it as `registrationSecret` in the request body). Leave it blank during
  local development to keep registration open.
- **Helmet** — sets safe security-related HTTP headers automatically.
- **Restricted CORS** — set `CORS_ORIGIN` in `.env` to a comma-separated
  list of allowed frontend URLs before putting this on the public
  internet. Leave blank locally to allow all origins.
- **Minimum password length** — admin passwords must be at least 8
  characters.

## 8. What's next

This backend now supports any number of admins each running any number of
committees. Ready to build the premium step-by-step frontend on top of it —
starting with an admin flow to create a committee and get its join code,
and a member flow to enter that code plus phone/PIN to see their own ledger.
