# AabeTahura Dashboard — Setup

Express + EJS app with a Google Sheets–backed login and dashboard.

After cloning, two secret files are **not** in the repo (on purpose) and must be
added before the app will run:

| File | What it is | How to create |
|------|-----------|----------------|
| `credentials.json` | Google service-account key (grants read access to the Google Sheet) | Copy `credentials.example.json` → `credentials.json` and paste your real key |
| `.env` | Payment-gateway secrets | Copy `.env.example` → `.env` and fill in the real values |

> Keep your real `credentials.json` and `.env` somewhere safe (e.g. a private
> backup folder). They are gitignored and will never be on GitHub.

## Run locally

```bash
npm install          # install dependencies
node index.js        # start the server
```

Then open http://localhost:3000

## Notes

- Requires Node.js 20.12+ (uses the built-in `process.loadEnvFile`).
- The service account must have access to the target Google Sheet
  (spreadsheet ID is set in `index.js`).
