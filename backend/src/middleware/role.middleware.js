const authorizeRoles = (...allowedRoles) => {

    if (
        allowedRoles.length === 0 ||
        !allowedRoles.every(role =>
            ["PATIENT", "DOCTOR", "ADMIN"].includes(role)
        )
    ) {
        throw new Error("Invalid role configuration");
    }
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action"
            });
        }

        next();
    };
};

module.exports = {
    authorizeRoles
};