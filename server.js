const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// IMPORTANT: this version serves index.html from the project ROOT.
// There is intentionally NO /public folder and no /src/public/index.html.
app.use(express.static(ROOT, {
  index: "index.html",
  extensions: ["html"]
}));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "west-amman-property-manager", version: "13.0.0" });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`West Amman Property Manager running on port ${PORT}`);
});
