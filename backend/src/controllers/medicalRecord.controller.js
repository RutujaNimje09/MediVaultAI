const pool = require("../config/database");
const fs = require("fs").promises;


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
                mr.ocr_verified_at,
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
                mr.ocr_verified_at,
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

        let ocrText = null;
        let ocrStatus = 'PENDING';
        let timeoutId;

        try {
            const fileBuffer = await fs.readFile(filePath);
            const blob = new Blob([fileBuffer], { type: mimeType });
            const formData = new FormData();
            formData.append("file", blob, fileName);

            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 30000);

            const ocrServiceUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000/ocr";
            const ocrResponse = await fetch(ocrServiceUrl, {
                method: "POST",
                body: formData,
                signal: controller.signal
            });

            if (ocrResponse.ok) {
                const ocrData = await ocrResponse.json();
                if (ocrData.success) {
                    ocrText = ocrData.extracted_text || null;
                    ocrStatus = 'COMPLETED';
                } else {
                    ocrStatus = 'FAILED';
                }
            } else {
                ocrStatus = 'FAILED';
            }
        } catch (ocrError) {
            console.error("OCR Service error:", ocrError);
            ocrStatus = 'FAILED';
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }

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
                file_size,
                ocr_text,
                ocr_status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14
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
                fileSize,
                ocrText,
                ocrStatus
            ]
        );

        res.status(201).json({
            success: true,
            message: "Medical record uploaded successfully",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Create medical record error:", error);

        if (req.file && req.file.path) {
            fs.unlink(req.file.path).catch(err =>
                console.error("Failed to delete orphaned file:", err)
            );
        }

        res.status(500).json({
            success: false,
            message: "Server error while uploading medical record"
        });
    }
};


// Update and verify extracted OCR text for a medical record
const updateMedicalRecordOcr = async (req, res) => {
    try {
        const { id } = req.params;
        const { ocr_text, ocr_verified = true } = req.body;

        if (ocr_text === undefined || ocr_text === null) {
            return res.status(400).json({
                success: false,
                message: "ocr_text is required for updating OCR content"
            });
        }

        const result = await pool.query(
            `UPDATE medical_records
             SET
                 ocr_text = $1,
                 ocr_verified = $2,
                 ocr_verified_at = CURRENT_TIMESTAMP,
                 ocr_status = 'COMPLETED',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
               AND owner_user_id = $4
               AND is_archived = FALSE
             RETURNING
                 id,
                 title,
                 description,
                 doctor_name,
                 hospital_name,
                 record_date,
                 file_name,
                 file_path,
                 mime_type,
                 file_size,
                 ocr_text,
                 ocr_status,
                 ocr_verified,
                 ocr_verified_at,
                 is_archived,
                 created_at,
                 updated_at`,
            [
                ocr_text,
                Boolean(ocr_verified),
                id,
                req.user.userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found or unauthorized"
            });
        }

        res.json({
            success: true,
            message: "OCR text updated and verified successfully",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Update medical record OCR error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while updating OCR text"
        });
    }
};


// Update general medical record fields and/or OCR text
const updateMedicalRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            doctor_name,
            hospital_name,
            record_date,
            category_id,
            family_profile_id,
            ocr_text,
            ocr_verified
        } = req.body;

        // Verify existence and ownership
        const existing = await pool.query(
            `SELECT * FROM medical_records WHERE id = $1 AND owner_user_id = $2 AND is_archived = FALSE`,
            [id, req.user.userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found or unauthorized"
            });
        }

        const current = existing.rows[0];

        const newTitle = title !== undefined ? title : current.title;
        const newDescription = description !== undefined ? description : current.description;
        const newDoctor = doctor_name !== undefined ? doctor_name : current.doctor_name;
        const newHospital = hospital_name !== undefined ? hospital_name : current.hospital_name;
        const newDate = record_date !== undefined ? record_date : current.record_date;
        const newCategory = category_id !== undefined ? category_id : current.category_id;
        const newFamily = family_profile_id !== undefined ? family_profile_id : current.family_profile_id;

        let newOcrText = current.ocr_text;
        let newOcrVerified = current.ocr_verified;
        let newOcrVerifiedAt = current.ocr_verified_at;
        let newOcrStatus = current.ocr_status;

        if (ocr_text !== undefined) {
            newOcrText = ocr_text;
            newOcrVerified = ocr_verified !== undefined ? Boolean(ocr_verified) : true;
            newOcrVerifiedAt = new Date();
            newOcrStatus = 'COMPLETED';
        }

        const result = await pool.query(
            `UPDATE medical_records
             SET
                 title = $1,
                 description = $2,
                 doctor_name = $3,
                 hospital_name = $4,
                 record_date = $5,
                 category_id = $6,
                 family_profile_id = $7,
                 ocr_text = $8,
                 ocr_verified = $9,
                 ocr_verified_at = $10,
                 ocr_status = $11,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
              AND owner_user_id = $13
              AND is_archived = FALSE
             RETURNING *`,
            [
                newTitle,
                newDescription,
                newDoctor,
                newHospital,
                newDate,
                newCategory,
                newFamily,
                newOcrText,
                newOcrVerified,
                newOcrVerifiedAt,
                newOcrStatus,
                id,
                req.user.userId
            ]
        );

        res.json({
            success: true,
            message: "Medical record updated successfully",
            record: result.rows[0]
        });

    } catch (error) {
        console.error("Update medical record error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while updating medical record"
        });
    }
};


module.exports = {
    getMedicalRecords,
    getMedicalRecordById,
    createMedicalRecord,
    updateMedicalRecordOcr,
    updateMedicalRecord
};
