
const express = require("express");

const {
    authenticateToken
} = require("../middleware/auth.middleware");

const {
    authorizeRoles
} = require("../middleware/role.middleware");

const {
    getMyEmergencyProfile,
    saveEmergencyProfile,
    generateEmergencyQR,
    getPublicEmergencyProfile,
    disableEmergencyQR
} = require("../controllers/emergency.controller");

const router = express.Router();

// Get the authenticated patient's emergency profile
router.get(
    "/profile",
    authenticateToken,
    authorizeRoles("PATIENT"),
    getMyEmergencyProfile
);

// Create or update the patient's emergency profile
router.put(
    "/profile",
    authenticateToken,
    authorizeRoles("PATIENT"),
    saveEmergencyProfile
);

// Generate or regenerate the Emergency QR
router.post(
    "/generate",
    authenticateToken,
    authorizeRoles("PATIENT"),
    generateEmergencyQR
);

// Public endpoint: retrieve limited emergency information using the QR token
router.get(
    "/public/:token",
    getPublicEmergencyProfile
);

// Disable the patient's Emergency QR
router.delete(
    "/disable",
    authenticateToken,
    authorizeRoles("PATIENT"),
    disableEmergencyQR
);

// Route health check
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Emergency QR routes are working"
    });
});

module.exports = router;
