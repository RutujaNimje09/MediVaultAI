
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

// Create a secure sharing link for a medical record
const createShareLink = async (req, res) => {
    try {
        const {
            record_id,
            permission = "VIEW",
            expires_at,
            max_access_count
        } = req.body;

        if (!record_id || !expires_at) {
            return res.status(400).json({
                success: false,
                message: "Record ID and expiry date are required"
            });
        }

        if (!["VIEW", "VIEW_DOWNLOAD"].includes(permission)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sharing permission"
            });
        }

        const expiryDate = new Date(expires_at);

        if (
            Number.isNaN(expiryDate.getTime()) ||
            expiryDate <= new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "Expiry date must be in the future"
            });
        }

        if (
            max_access_count !== undefined &&
            max_access_count !== null &&
            (!Number.isInteger(max_access_count) || max_access_count < 1)
        ) {
            return res.status(400).json({
                success: false,
                message: "Maximum access count must be a positive integer"
            });
        }

        // Verify ownership and ensure the record is not archived
        const recordResult = await pool.query(
            `SELECT id
             FROM medical_records
             WHERE id = $1
               AND owner_user_id = $2
               AND is_archived = FALSE`,
            [record_id, req.user.userId]
        );

        if (recordResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medical record not found"
            });
        }

        // Generate a secure, unpredictable token
        const token = crypto.randomBytes(32).toString("hex");

        // Store only its SHA-256 hash
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const result = await pool.query(
            `INSERT INTO shared_records (
                record_id,
                shared_by,
                share_token_hash,
                permission,
                expires_at,
                max_access_count
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                record_id,
                permission,
                expires_at,
                max_access_count,
                created_at`,
            [
                record_id,
                req.user.userId,
                tokenHash,
                permission,
                expiryDate.toISOString(),
                max_access_count ?? null
            ]
        );

        const frontendUrl = (
        process.env.FRONTEND_URL || "http://localhost:5173"
        ).replace(/\/+$/, "");

        const shareUrl = `${frontendUrl}/shared/${token}`;

        return res.status(201).json({
            success: true,
            message: "Sharing link created successfully",
            share: result.rows[0],
            share_url: shareUrl
        });
    } catch (error) {
        console.error("Create sharing link error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while creating sharing link"
        });
    }
};

// Retrieve a medical record using its public sharing token
const getSharedRecord = async (req, res) => {
    const { token } = req.params;

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(404).json({
            success: false,
            message: "Sharing link is invalid or unavailable"
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        await client.query("BEGIN");
        transactionStarted = true;

        // Lock the row so concurrent requests cannot bypass the access limit
        const shareResult = await client.query(
            `SELECT
                sr.id AS share_id,
                sr.record_id,
                sr.permission,
                sr.expires_at,
                sr.max_access_count,
                sr.access_count,
                mr.title,
                mr.description,
                mr.doctor_name,
                mr.hospital_name,
                mr.record_date,
                mr.file_name,
                mr.mime_type
             FROM shared_records sr
             JOIN medical_records mr
               ON mr.id = sr.record_id
             WHERE sr.share_token_hash = $1
               AND sr.revoked_at IS NULL
               AND sr.expires_at > NOW()
               AND mr.is_archived = FALSE
             FOR UPDATE OF sr`,
            [tokenHash]
        );

        if (shareResult.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Sharing link is invalid or unavailable"
            });
        }

        const share = shareResult.rows[0];

        if (
            share.max_access_count !== null &&
            Number(share.access_count) >= Number(share.max_access_count)
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                success: false,
                message: "Sharing link access limit has been reached"
            });
        }

        // Count this successful metadata access
        await client.query(
            `UPDATE shared_records
             SET access_count = access_count + 1
             WHERE id = $1`,
            [share.share_id]
        );

        // Log the public access
        await client.query(
            `INSERT INTO sharing_access_logs (
                shared_record_id,
                accessed_by,
                ip_address
            )
            VALUES ($1, NULL, $2)`,
            [share.share_id, req.ip]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        // Return permitted metadata only; never expose the file path or OCR text
        return res.status(200).json({
            success: true,
            share: {
                permission: share.permission,
                expires_at: share.expires_at
            },
            record: {
                title: share.title,
                description: share.description,
                doctor_name: share.doctor_name,
                hospital_name: share.hospital_name,
                record_date: share.record_date,
                file_name: share.file_name,
                mime_type: share.mime_type
            }
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Sharing transaction rollback error:",
                    rollbackError
                );
            }
        }

        console.error("Get shared record error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while retrieving shared record"
        });
    } finally {
        if (client) {
            client.release();
        }
    }
};

// Revoke a sharing link owned by the logged-in user
const revokeShareLink = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Sharing link ID is required"
            });
        }

        const result = await pool.query(
            `UPDATE shared_records sr
             SET revoked_at = CURRENT_TIMESTAMP
             FROM medical_records mr
             WHERE sr.id = $1
               AND sr.record_id = mr.id
               AND mr.owner_user_id = $2
               AND sr.revoked_at IS NULL
             RETURNING sr.id, sr.revoked_at`,
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Sharing link not found or already revoked"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sharing link revoked successfully",
            share: result.rows[0]
        });
    } catch (error) {
        console.error("Revoke sharing link error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while revoking sharing link"
        });
    }
};
// View or download a medical record through a valid sharing link
const getSharedRecordFile = async (req, res) => {
    const { token } = req.params;
    const download = req.query.download === "true";

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(404).json({
            success: false,
            message: "Sharing link is invalid or unavailable"
        });
    }

    let client;
    let transactionStarted = false;

    try {
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        client = await pool.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await client.query(
            `SELECT
                sr.id AS share_id,
                sr.permission,
                sr.expires_at,
                sr.max_access_count,
                sr.access_count,
                mr.file_path,
                mr.file_name,
                mr.mime_type
             FROM shared_records sr
             JOIN medical_records mr
                ON mr.id = sr.record_id
             WHERE sr.share_token_hash = $1
               AND sr.revoked_at IS NULL
               AND sr.expires_at > NOW()
               AND mr.is_archived = FALSE
             FOR UPDATE OF sr`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Sharing link is invalid or unavailable"
            });
        }

        const share = result.rows[0];

        if (
            share.max_access_count !== null &&
            Number(share.access_count) >=
                Number(share.max_access_count)
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                success: false,
                message: "Sharing link access limit has been reached"
            });
        }

        if (download && share.permission !== "VIEW_DOWNLOAD") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(403).json({
                success: false,
                message: "Downloading is not permitted for this link"
            });
        }

        // Resolve the stored file path and restrict access to backend/uploads.
        const uploadDirectory = path.resolve(__dirname, "../../uploads");
        const filePath = path.resolve(share.file_path || "");

        if (
            !share.file_path ||
            !filePath.startsWith(uploadDirectory + path.sep)
        ) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Medical record file is unavailable"
            });
        }

        const fileStat = await fs.promises.stat(filePath).catch(() => null);

        if (!fileStat || !fileStat.isFile()) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Medical record file is unavailable"
            });
        }

        await client.query(
            `UPDATE shared_records
             SET access_count = access_count + 1
             WHERE id = $1`,
            [share.share_id]
        );

        await client.query(
            `INSERT INTO sharing_access_logs (
                shared_record_id,
                accessed_by,
                ip_address
             )
             VALUES ($1, NULL, $2)`,
            [share.share_id, req.ip]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        res.setHeader(
            "Content-Type",
            share.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        if (download) {
            return res.download(
                filePath,
                path.basename(share.file_name || "medical-record"),
                (error) => {
                    if (error && !res.headersSent) {
                        console.error("Shared file download error:", error);
                        res.status(500).json({
                            success: false,
                            message: "Unable to download medical record"
                        });
                    }
                }
            );
        }

        return res.sendFile(filePath, (error) => {
            if (error && !res.headersSent) {
                console.error("Shared file viewing error:", error);
                res.status(500).json({
                    success: false,
                    message: "Unable to display medical record"
                });
            }
        });
    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("File access rollback error:", rollbackError);
            }
        }

        console.error("Get shared record file error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: "Server error while accessing medical record"
            });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
module.exports = {
    createShareLink,
    getSharedRecord,
    revokeShareLink,
    getSharedRecordFile
};
