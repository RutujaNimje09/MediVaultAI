const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    try {

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Server authentication configuration error"
            });
        }
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required"
            });
        }

        const [scheme, token] = authHeader.split(" ");
        if (scheme !== "Bearer" || !token || !token.trim()) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication header"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();

    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token"
        });
    }
};

module.exports = {
    authenticateToken
};