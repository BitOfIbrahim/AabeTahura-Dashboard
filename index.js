import express from "express";
import { google } from "googleapis";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import crypto from "crypto";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

// Setup for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env (payment secrets kept out of source control)
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // .env is optional; env vars may be provided by the host instead
}

// Read credentials.json
const credentials = JSON.parse(
  await readFile(path.join(__dirname, "credentials.json"), "utf-8")
);

const app = express();
const PORT = 3000;

// Middleware setup
app.use(cors());
app.use("/static", express.static(path.join(__dirname, "src", "public")));


app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 12 * 60 * 60 * 1000, httpOnly: true },
  })
);

// Google Sheets API config
const SPREADSHEET_ID = "1z-3fUbosdoxaJ-yp2TNyF8UOjbEr5dQbFS79LoBlBRE";
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function fetchSheetData(sheetName, range) {
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    return res.data.values;
  } catch (err) {
    console.error(`Error fetching ${sheetName}:`, err.message);
    throw err;
  }
}

// Middleware to check login
function isAuthenticated(req, res, next) {
  if (req.session.isLoggedIn) return next();
  res.redirect("/");
}

// Auto-redirect to dashboard
app.use((req, res, next) => {
  if (req.session.isLoggedIn && req.path === "/") {
    return res.redirect("/DashBoard");
  }
  next();
});

// Login page
app.get("/", (req, res) => {
  res.render("login");
});

// Handle login
app.post("/DashBoard", async (req, res) => {
  const { username, password } = req.body;
  const normalize = (str) => str?.toLowerCase().replace(/\s+/g, "") || "";

  try {
    const loginData = await fetchSheetData("Login", "A:B");

    const isValidUser = loginData.some(([id, pass]) =>
      normalize(id) === normalize(username) && normalize(pass) === normalize(password)
    );

    if (isValidUser) {
      req.session.isLoggedIn = true;
      req.session.username = normalize(username);
      req.session.password = normalize(password);
      res.redirect("/DashBoard");
    } else {
      res.status(401).send("Invalid username or password!");
    }
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

// Dashboard
app.get("/DashBoard", isAuthenticated, async (req, res) => {
  try {
    const { username, password } = req.session;
    const normalize = (str) => str?.toLowerCase().replace(/\s+/g, "") || "";

    const [dataList, monthlyReport, reportData, debtData] = await Promise.all([
      fetchSheetData("DataList", "A:AC"),
      fetchSheetData("Monthly Report", "A:H"),
      fetchSheetData("Report", "A:F"),
      fetchSheetData("debt", "A:Z"),
    ]);

    const filteredDataList = dataList.filter(
      (row) => normalize(row[8]) === username && normalize(row[9]) === password
    );

    const filteredMonthlyReport = monthlyReport.filter(
      (row) => normalize(row[4]) === username && normalize(row[3]) === password
    );

    const filteredReportData = reportData.filter(
      (row) => normalize(row[1]) === username && normalize(row[2]) === password
    );

    const matchingDebtRow = debtData.find((row) => normalize(row[12]) === username);
    const walletAmount = matchingDebtRow ? parseInt(matchingDebtRow[25]) || 0 : 0;

    res.render("dashboard", {
      dataList: filteredDataList,
      monthlyReport: filteredMonthlyReport,
      reportData: filteredReportData,
      walletAmount,
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).send("Failed to load dashboard.");
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Error logging out.");
    res.redirect("/");
  });
});

// Payment utility (keep as-is)
const MERCHANT_ID = process.env.MERCHANT_ID;
const STORE_ID = process.env.STORE_ID;
const MERCHANT_HASH = process.env.MERCHANT_HASH;
const MERCHANT_USERNAME = process.env.MERCHANT_USERNAME;
const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD;
const KEY1 = Buffer.from(process.env.KEY1 || "", "utf8");
const KEY2 = Buffer.from(process.env.KEY2 || "", "utf8");

function generateRequestHash(fields) {
  const mapString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const cipher = crypto.createCipheriv("aes-128-cbc", KEY1, KEY2);
  let encrypted = cipher.update(mapString, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
