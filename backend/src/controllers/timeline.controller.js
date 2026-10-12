
const pool = require("../config/database");

// Get all timeline events belonging to the logged-in user
const getTimelineEvents = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT *
             FROM timeline_events
             WHERE owner_user_id = $1
             ORDER BY event_date DESC, created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            events: result.rows
        });
    } catch (error) {
        console.error("Get timeline events error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch timeline events"
        });
    }
};

// Create a new timeline event
const createTimelineEvent = async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            family_profile_id,
            event_type,
            title,
            description,
            event_date,
            source_type,
            source_id
        } = req.body;

        if (!event_type || !title || !event_date) {
            return res.status(400).json({
                success: false,
                message: "Event type, title, and event date are required"
            });
        }

        const result = await pool.query(
            `INSERT INTO timeline_events (
                owner_user_id,
                family_profile_id,
                event_type,
                title,
                description,
                event_date,
                source_type,
                source_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                userId,
                family_profile_id || null,
                event_type,
                title,
                description || null,
                event_date,
                source_type || null,
                source_id || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Timeline event created successfully",
            event: result.rows[0]
        });
    } catch (error) {
        console.error("Create timeline event error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create timeline event"
        });
    }
};

module.exports = {
    getTimelineEvents,
    createTimelineEvent
};
