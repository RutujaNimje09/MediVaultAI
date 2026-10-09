const express = require("express");

const {
    authenticateToken
} = require("../middleware/auth.middleware");

const {
    authorizeRoles
} = require("../middleware/role.middleware");

const {
    getProfile,
    updateProfile
} = require("../controllers/user.controller");

const router = express.Router();


// Get current user's profile
router.get(
    "/profile",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    getProfile
);


// Update current user's profile
router.put(
    "/profile",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    updateProfile
);


module.exports = router;