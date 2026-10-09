const express = require("express");

const {
register,
login,
refreshAccessToken,
logout
} = require("../controllers/auth.controller");

const {
authLimiter
} = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refreshAccessToken);
router.post("/logout", authLimiter, logout);

module.exports = router;
