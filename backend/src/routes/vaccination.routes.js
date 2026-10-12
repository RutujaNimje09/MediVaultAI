
const express = require("express");
const router = express.Router();

const {
    getVaccinations,
    createVaccination
} = require("../controllers/vaccination.controller");

const { authenticateToken } = require("../middleware/auth.middleware");

// All vaccination endpoints require authentication
router.get("/", authenticateToken, getVaccinations);
router.post("/", authenticateToken, createVaccination);

// Basic route test
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Vaccination routes are working"
    });
});

module.exports = router;
