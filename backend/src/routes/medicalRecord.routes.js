const express = require("express");

const {
    authenticateToken
} = require("../middleware/auth.middleware");

const {
    authorizeRoles
} = require("../middleware/role.middleware");

const upload = require("../config/upload");

const {
    getMedicalRecords,
    getMedicalRecordById,
    createMedicalRecord
} = require("../controllers/medicalRecord.controller");

const router = express.Router();


// Get all medical records
router.get(
    "/",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    getMedicalRecords
);


// Get one medical record
router.get(
    "/:id",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    getMedicalRecordById
);


// Upload and create medical record
router.post(
    "/",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    upload.single("file"),
    createMedicalRecord
);


module.exports = router;