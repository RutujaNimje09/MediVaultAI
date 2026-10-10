
const pool = require("../config/database");

// Get all reminders belonging to the logged-in user
const getReminders = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT *
             FROM reminders
             WHERE owner_user_id = $1
             ORDER BY reminder_date ASC, reminder_time ASC NULLS LAST`,
            [userId]
        );

        res.json({
            success: true,
            reminders: result.rows
        });
    } catch (error) {
        console.error("Get reminders error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch reminders"
        });
    }
};

// Create a new reminder
const createReminder = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            family_profile_id,
            reminder_type,
            title,
            message,
            reminder_date,
            reminder_time,
            related_appointment_id,
            related_vaccination_id
        } = req.body;

        if (!reminder_type || !title || !reminder_date) {
            return res.status(400).json({
                success: false,
                message: "Reminder type, title, and reminder date are required"
            });
        }

        const allowedTypes = ["APPOINTMENT", "VACCINATION", "GENERAL"];

        if (!allowedTypes.includes(reminder_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid reminder type"
            });
        }

        const result = await pool.query(
            `INSERT INTO reminders (
                owner_user_id,
                family_profile_id,
                reminder_type,
                title,
                message,
                reminder_date,
                reminder_time,
                related_appointment_id,
                related_vaccination_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                userId,
                family_profile_id || null,
                reminder_type,
                title,
                message || null,
                reminder_date,
                reminder_time || null,
                related_appointment_id || null,
                related_vaccination_id || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Reminder created successfully",
            reminder: result.rows[0]
        });
    } catch (error) {
        console.error("Create reminder error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create reminder"
        });
    }
};

// Mark a reminder as completed or not completed
const updateReminderStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { is_completed } = req.body;

        if (typeof is_completed !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_completed must be true or false"
            });
        }

        const result = await pool.query(
            `UPDATE reminders
             SET is_completed = $1
             WHERE id = $2 AND owner_user_id = $3
             RETURNING *`,
            [is_completed, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reminder not found"
            });
        }

        res.json({
            success: true,
            message: "Reminder status updated successfully",
            reminder: result.rows[0]
        });
    } catch (error) {
        console.error("Update reminder error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update reminder status"
        });
    }
};

module.exports = {
    getReminders,
    createReminder,
    updateReminderStatus
};
