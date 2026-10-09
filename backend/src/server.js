const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const pool = require("./config/database");

const app = express();

// ==============================
// Middleware
// ==============================

app.use(helmet());

app.use(
    cors({
        origin: "http://localhost:5173"
    })
);

app.use(express.json());

// ==============================
// Health Check
// ==============================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "MediVault backend is running"
    });
});

// ==============================
// Routes
// ==============================

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const medicalRecordRoutes = require("./routes/medicalRecord.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const vaccinationRoutes = require("./routes/vaccination.routes");
const timelineRoutes = require("./routes/timeline.routes");
const reminderRoutes = require("./routes/reminder.routes");
const sharingRoutes = require("./routes/sharing.routes");
const emergencyRoutes = require("./routes/emergency.routes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/vaccinations", vaccinationRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/sharing", sharingRoutes);
app.use("/api/emergency", emergencyRoutes);

// ==============================
// Start Server
// ==============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`MediVault backend running on port ${PORT}`);
});