
const express = require("express");

const {
    authenticateToken
} = require("../middleware/auth.middleware");

const {
    authorizeRoles
} = require("../middleware/role.middleware");

const {
    createShareLink,
    getSharedRecord,
    revokeShareLink,
    getSharedRecordFile
} = require("../controllers/sharing.controller");

const router = express.Router();

// Create a sharing link: authenticated patients only
router.post(
    "/",
    authenticateToken,
    authorizeRoles("PATIENT"),
    createShareLink
);

// Public endpoint: retrieve permitted record metadata using a token
router.get("/public/:token", getSharedRecord);

// Public endpoint: view or download a shared medical record file
router.get("/public/:token/file", getSharedRecordFile);

// Revoke a sharing link: authenticated patients only
router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("PATIENT"),
    revokeShareLink
);

// Route health check
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Sharing routes are working"
    });
});

module.exports = router;
