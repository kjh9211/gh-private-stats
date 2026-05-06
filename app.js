require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

// Trust Vercel's reverse proxy so req.ip and secure cookies work correctly
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/", dashboardRoutes);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
