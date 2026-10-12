
const crypto = require("crypto");
const pool = require("../config/database");

// 1. Get the patient's own emergency profile
const getMyEmergencyProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT
                id,
                blood_group,
                allergies,
                chronic_conditions,
                emergency_contact_name,
                emergency_contact_phone,
                emergency_notes,
                is_active,
                updated_at
             FROM emergency_profiles
             WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                profile: null,
                message: "Emergency profile has not been created yet"
            });
        }

        return res.json({
            success: true,
            profile: result.rows[0]
        });
    } catch (error) {
        console.error("Get emergency profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve emergency profile"
        });
    }
};

// 2. Save or update the patient's emergency profile
const saveEmergencyProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            blood_group,
            allergies,
            chronic_conditions,
            emergency_contact_name,
            emergency_contact_phone,
            emergency_notes
        } = req.body;

        const result = await pool.query(
            `INSERT INTO emergency_profiles (
                user_id,
                blood_group,
                allergies,
                chronic_conditions,
                emergency_contact_name,
                emergency_contact_phone,
                emergency_notes,
                is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
            ON CONFLICT (user_id)
            DO UPDATE SET
                blood_group = EXCLUDED.blood_group,
                allergies = EXCLUDED.allergies,
                chronic_conditions = EXCLUDED.chronic_conditions,
                emergency_contact_name = EXCLUDED.emergency_contact_name,
                emergency_contact_phone = EXCLUDED.emergency_contact_phone,
                emergency_notes = EXCLUDED.emergency_notes,
                updated_at = CURRENT_TIMESTAMP
            RETURNING
                id,
                blood_group,
                allergies,
                chronic_conditions,
                emergency_contact_name,
                emergency_contact_phone,
                emergency_notes,
                is_active,
                updated_at`,
            [
                userId,
                blood_group || null,
                allergies || null,
                chronic_conditions || null,
                emergency_contact_name || null,
                emergency_contact_phone || null,
                emergency_notes || null
            ]
        );

        return res.json({
            success: true,
            message: "Emergency profile saved successfully",
            profile: result.rows[0]
        });
    } catch (error) {
        console.error("Save emergency profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to save emergency profile"
        });
    }
};

// 3. Generate or regenerate the Emergency QR token
const generateEmergencyQR = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Generate a cryptographically secure, unpredictable token
        const token = crypto.randomBytes(32).toString("hex");

        // Store only the hash in the database
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await pool.query(
            `UPDATE emergency_profiles
             SET qr_token_hash = $1,
                 is_active = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $2
             RETURNING id`,
            [tokenHash, userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Save your emergency profile before generating a QR code"
            });
        }

        const frontendUrl = (
            process.env.FRONTEND_URL || "http://localhost:5173"
        ).replace(/\/+$/, "");

        return res.json({
            success: true,
            message: "Emergency QR token generated successfully",
            token,
            qrUrl: `${frontendUrl}/emergency/${token}`
        });
    } catch (error) {
        console.error("Generate Emergency QR error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to generate Emergency QR"
        });
    }
};

// 4. Public endpoint used when an emergency QR is scanned
const getPublicEmergencyProfile = async (req, res) => {
    try {
        const { token } = req.params;

        // Reject tokens that don't have the expected format
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return res.status(404).json({
                success: false,
                message: "Emergency profile is unavailable"
            });
        }

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await pool.query(
            `SELECT
                u.full_name,
                ep.blood_group,
                ep.allergies,
                ep.chronic_conditions,
                ep.emergency_contact_name,
                ep.emergency_contact_phone,
                ep.emergency_notes
             FROM emergency_profiles ep
             JOIN users u ON u.id = ep.user_id
             WHERE ep.qr_token_hash = $1
               AND ep.is_active = TRUE
               AND u.is_active = TRUE`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Emergency profile is unavailable"
            });
        }

        return res.set("Cache-Control", "no-store").json({
            success: true,
            profile: result.rows[0]
        });
    } catch (error) {
        console.error("Public emergency profile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve emergency information"
        });
    }
};

// 5. Disable the Emergency QR
const disableEmergencyQR = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE emergency_profiles
             SET is_active = FALSE,
                 qr_token_hash = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1
             RETURNING id`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Emergency profile not found"
            });
        }

        return res.json({
            success: true,
            message: "Emergency QR disabled successfully"
        });
    } catch (error) {
        console.error("Disable Emergency QR error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to disable Emergency QR"
        });
    }
};

module.exports = {
    getMyEmergencyProfile,
    saveEmergencyProfile,
    generateEmergencyQR,
    getPublicEmergencyProfile,
    disableEmergencyQR
};
