
const pool = require("../config/database");

// Get all appointments belonging to the logged-in user
const getAppointments = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT *
             FROM appointments
             WHERE owner_user_id = $1
             ORDER BY appointment_date ASC, appointment_time ASC NULLS LAST`,
            [userId]
        );

        res.json({
            success: true,
            appointments: result.rows
        });
    } catch (error) {
        console.error("Get appointments error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch appointments"
        });
    }
};

// Create a new appointment
const createAppointment = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            family_profile_id,
            doctor_id,
            title,
            appointment_date,
            appointment_time,
            hospital_name,
            location,
            notes,
            reminder_minutes,
            reminder_enabled
        } = req.body;

        if (!title || !appointment_date) {
            return res.status(400).json({
                success: false,
                message: "Title and appointment date are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO appointments (
                owner_user_id,
                family_profile_id,
                doctor_id,
                title,
                appointment_date,
                appointment_time,
                hospital_name,
                location,
                notes,
                reminder_minutes,
                reminder_enabled
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                userId,
                family_profile_id || null,
                doctor_id || null,
                title,
                appointment_date,
                appointment_time || null,
                hospital_name || null,
                location || null,
                notes || null,
                reminder_minutes ?? 60,
                reminder_enabled ?? true
            ]
        );

        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error("Create appointment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create appointment"
        });
    }
};

// Update appointment status
const updateAppointmentStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            "SCHEDULED",
            "COMPLETED",
            "CANCELLED"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appointment status"
            });
        }

        const result = await pool.query(
            `UPDATE appointments
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND owner_user_id = $3
             RETURNING *`,
            [status, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }

        res.json({
            success: true,
            message: "Appointment status updated",
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error("Update appointment error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update appointment"
        });
    }
};

module.exports = {
    getAppointments,
    createAppointment,
    updateAppointmentStatus
};
