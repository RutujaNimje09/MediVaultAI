
const express = require("express");
const router = express.Router();

const {
    getAppointments,
    createAppointment,
    updateAppointmentStatus
} = require("../controllers/appointment.controller");

const { authenticateToken } = require("../middleware/auth.middleware");

// All appointment endpoints require authentication
router.get("/", authenticateToken, getAppointments);
router.post("/", authenticateToken, createAppointment);
router.patch("/:id/status", authenticateToken, updateAppointmentStatus);

// Basic route test
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Appointment routes are working"
    });
});

module.exports = router;
