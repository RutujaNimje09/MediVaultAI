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
    createMedicalRecord,
    updateMedicalRecordOcr,
    updateMedicalRecord
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


// Update OCR extracted text specifically (supports both PATCH and PUT)
router.patch(
    "/:id/ocr",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    updateMedicalRecordOcr
);

router.put(
    "/:id/ocr",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    updateMedicalRecordOcr
);


// Update general medical record fields and/or OCR text
router.put(
    "/:id",
    authenticateToken,
    authorizeRoles("PATIENT", "DOCTOR", "ADMIN"),
    updateMedicalRecord
);


module.exports = router;