const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const pool = require("./config/database");

const app = express();

app.use(helmet());

app.use(
    cors({
        origin: "http://localhost:5173"
    })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "MediVault backend is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`MediVault backend running on port ${PORT}`);
});