const express = require("express");

const router = express.Router();

router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Sharing routes are working"
    });
});

module.exports = router;