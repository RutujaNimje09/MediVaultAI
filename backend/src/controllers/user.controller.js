const pool = require("../config/database");

// Get current user's profile
const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                full_name,
                email,
                role,
                phone,
                date_of_birth,
                gender,
                is_active,
                created_at,
                updated_at
             FROM users
             WHERE id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Get profile error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching profile"
        });
    }
};


// Update current user's profile
const updateProfile = async (req, res) => {
    try {
        const {
            full_name,
            phone,
            date_of_birth,
            gender
        } = req.body;

        if (!full_name) {
            return res.status(400).json({
                success: false,
                message: "Full name is required"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET
                full_name = $1,
                phone = $2,
                date_of_birth = $3,
                gender = $4,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING
                id,
                full_name,
                email,
                role,
                phone,
                date_of_birth,
                gender,
                is_active,
                created_at,
                updated_at`,
            [
                full_name,
                phone || null,
                date_of_birth || null,
                gender || null,
                req.user.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Update profile error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while updating profile"
        });
    }
};


module.exports = {
    getProfile,
    updateProfile
};