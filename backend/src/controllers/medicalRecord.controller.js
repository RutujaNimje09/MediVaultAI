const pool = require("../config/database");


// Get medical records for current user
const getMedicalRecords = async (req, res) => {
    try {
        const {
            category_id,
            doctor_name,
            hospital_name,
            from_date,
            to_date,
            search
        } = req.query;

        let query = `
            SELECT
                mr.id,
                mr.title,
                mr.description,
                mr.doctor_name,
                mr.hospital_name,
                mr.record_date,
                mr.file_name,
                mr.file_path,
                mr.mime_type,
                mr.file_size,
                mr.ocr_text,
                mr.ocr_status,
                mr.ocr_verified,
                mr.is_archived,
                mr.created_at,
                mr.updated_at,
                rc.name AS category_name
            FROM medical_records mr
            LEFT JOIN record_categories rc
                ON mr.category_id = rc.id
            WHERE mr.owner_user_id = $1
              AND mr.is_archived = FALSE
        `;

        const values = [req.user.userId];
        let parameterIndex = 2;

        if (category_id) {
            query += ` AND mr.category_id = $${parameterIndex}`;
            values.push(category_id);
            parameterIndex++;
        }

        if (doctor_name) {
            query += ` AND mr.doctor_name ILIKE $${parameterIndex}`;
            values.push(`%${doctor_name}%`);
            parameterIndex++;
        }

        if (hospital_name) {
            query += ` AND mr.hospital_name ILIKE $${parameterIndex}`;
            values.push(`%${hospital_name}%`);
            parameterIndex++;
        }

        if (from_date) {
            query += ` AND mr.record_date >= $${parameterIndex}`;
            values.push(from_date);
            parameterIndex++;
        }

        if (to_date) {
            query += ` AND mr.record_date <= $${parameterIndex}`;
            values.push(to_date);
            parameterIndex++;
        }

        if (search) {
            query += `
                AND (
                    mr.title ILIKE $${parameterIndex}
                    OR mr.description ILIKE $${parameterIndex}
                    OR mr.doctor_name ILIKE $${parameterIndex}
                    OR mr.hospital_name ILIKE $${parameterIndex}
                    OR mr.ocr_text ILIKE $${parameterIndex}
                )
            `;

            values.push(`%${search}%`);
            parameterIndex++;
        }

        query += `
            ORDER BY mr.record_date DESC NULLS LAST,
                     mr.created_at DESC
        `;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            count: result.rows.length,
            records: result.rows
        });

    } catch (error) {
        console.error("Get medical records error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching medical records"
        });
    }
};


// Get one medical record
const getMedicalRecordById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                mr.id,
                mr.title,
                mr.description,
                mr.doctor_name,
                mr.hospital_name,
                mr.record_date,
                mr.file_name,
                mr.file_path,
                mr.mime_type,
                mr.file_size,
                mr.ocr_text,
                mr.ocr_status,
                mr.ocr_verified,
                mr.is_archived,
                mr.created_at,
                mr.updated_at,
                rc.name AS category_name
             FROM medical_records mr
             LEFT JOIN record_categories rc
                ON mr.category_id = rc.id
             WHERE mr.id = $1
               AND mr.owner_user_id = $2`,
            [id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found"
            });
        }

        res.json({
            success: true,
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Get medical record error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while fetching medical record"
        });
    }
};


// Create medical record using uploaded file
const createMedicalRecord = async (req, res) => {
    try {
        const {
            title,
            description,
            doctor_name,
            hospital_name,
            record_date,
            category_id,
            family_profile_id
        } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Title is required"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Medical document file is required"
            });
        }

        const fileName = req.file.originalname;
        const filePath = req.file.path;
        const mimeType = req.file.mimetype;
        const fileSize = req.file.size;

        const result = await pool.query(
            `INSERT INTO medical_records (
                owner_user_id,
                family_profile_id,
                category_id,
                title,
                description,
                doctor_name,
                hospital_name,
                record_date,
                file_name,
                file_path,
                mime_type,
                file_size
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12
            )
            RETURNING *`,
            [
                req.user.userId,
                family_profile_id || null,
                category_id || null,
                title,
                description || null,
                doctor_name || null,
                hospital_name || null,
                record_date || null,
                fileName,
                filePath,
                mimeType,
                fileSize
            ]
        );

        res.status(201).json({
            success: true,
            message: "Medical record uploaded successfully",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Create medical record error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while uploading medical record"
        });
    }
};


module.exports = {
    getMedicalRecords,
    getMedicalRecordById,
    createMedicalRecord
};