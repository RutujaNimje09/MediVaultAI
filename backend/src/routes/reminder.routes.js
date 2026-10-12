
const express = require("express");
const router = express.Router();

const {
    getReminders,
    createReminder,
    updateReminderStatus
} = require("../controllers/reminder.controller");

const { authenticateToken } = require("../middleware/auth.middleware");

// All reminder endpoints require authentication
router.get("/", authenticateToken, getReminders);
router.post("/", authenticateToken, createReminder);
router.patch("/:id/status", authenticateToken, updateReminderStatus);

// Basic route test
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Reminder routes are working"
    });
});

module.exports = router;
