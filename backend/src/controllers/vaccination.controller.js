
const pool = require("../config/database");

// Get all vaccinations belonging to the logged-in user
const getVaccinations = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT *
             FROM vaccinations
             WHERE owner_user_id = $1
             ORDER BY vaccination_date DESC`,
            [userId]
        );

        res.json({
            success: true,
            vaccinations: result.rows
        });
    } catch (error) {
        console.error("Get vaccinations error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch vaccinations"
        });
    }
};

// Create a new vaccination record
const createVaccination = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            family_profile_id,
            vaccine_name,
            vaccination_date,
            next_due_date,
            dose_number,
            hospital_name,
            notes,
            reminder_enabled
        } = req.body;

        if (!vaccine_name || !vaccination_date) {
            return res.status(400).json({
                success: false,
                message: "Vaccine name and vaccination date are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO vaccinations (
                owner_user_id,
                family_profile_id,
                vaccine_name,
                vaccination_date,
                next_due_date,
                dose_number,
                hospital_name,
                notes,
                reminder_enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                userId,
                family_profile_id || null,
                vaccine_name,
                vaccination_date,
                next_due_date || null,
                dose_number ?? null,
                hospital_name || null,
                notes || null,
                reminder_enabled ?? true
            ]
        );

        res.status(201).json({
            success: true,
            message: "Vaccination recorded successfully",
            vaccination: result.rows[0]
        });
    } catch (error) {
        console.error("Create vaccination error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create vaccination record"
        });
    }
};

module.exports = {
    getVaccinations,
    createVaccination
};
