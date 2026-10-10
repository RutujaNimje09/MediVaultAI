
const express = require("express");
const router = express.Router();

const {
    getTimelineEvents,
    createTimelineEvent
} = require("../controllers/timeline.controller");

const { authenticateToken } = require("../middleware/auth.middleware");

// All timeline endpoints require authentication
router.get("/", authenticateToken, getTimelineEvents);
router.post("/", authenticateToken, createTimelineEvent);

// Basic route test
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Timeline routes are working"
    });
});

module.exports = router;
