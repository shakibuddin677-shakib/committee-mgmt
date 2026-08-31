require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const committeeRoutes = require("./routes/committeeRoutes");

connectDB();

const app = express();

// Security headers (hides tech stack details, sets safe defaults for
// content-type sniffing, clickjacking, etc.)
app.use(helmet());

// CORS_ORIGIN in .env can be a comma-separated list, e.g.
// "http://localhost:5173,https://yourapp.com". If it's not set at all,
// all origins are allowed — fine for local development, but you should
// set this explicitly before putting the API on the public internet.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : null;

app.use(
  cors(
    allowedOrigins
      ? {
          origin: (origin, callback) => {
            // allow requests with no origin (like Postman, curl, mobile apps)
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error("Not allowed by CORS"));
          },
        }
      : {}
  )
);

app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ success: true, message: "Committee Management API is running." });
});

app.use("/api/auth", authRoutes);
// Members, payments, loans, dashboard all nest under a committee:
// /api/committees/:committeeId/members, /payments, /loans, /dashboard
app.use("/api/committees", committeeRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
