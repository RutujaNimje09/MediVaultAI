CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. USERS
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'PATIENT'
        CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),

    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. REFRESH TOKENS / SESSIONS
-- =========================================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 3. FAMILY PROFILES
-- =========================================================

CREATE TABLE family_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    full_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,

    date_of_birth DATE,
    gender VARCHAR(20),
    phone VARCHAR(20),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 4. RECORD CATEGORIES
-- =========================================================

CREATE TABLE record_categories (
    id SERIAL PRIMARY KEY,

    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 5. MEDICAL RECORDS
-- =========================================================

CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_profile_id UUID
        REFERENCES family_profiles(id) ON DELETE SET NULL,

    category_id INTEGER
        REFERENCES record_categories(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    doctor_name VARCHAR(150),
    hospital_name VARCHAR(150),

    record_date DATE,

    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,

    -- OCR
    ocr_text TEXT,
    ocr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),

    ocr_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ocr_verified_at TIMESTAMPTZ,

    -- Record management
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 6. DOCTORS
-- =========================================================

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,

    doctor_name VARCHAR(150) NOT NULL,
    specialization VARCHAR(100),
    hospital_name VARCHAR(150),

    phone VARCHAR(20),
    email VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 7. DOCTOR-PATIENT AUTHORIZATION
-- =========================================================

CREATE TABLE doctor_patient_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    doctor_id UUID NOT NULL
        REFERENCES doctors(id) ON DELETE CASCADE,

    patient_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    access_type VARCHAR(30) NOT NULL DEFAULT 'VIEW'
        CHECK (access_type IN ('VIEW', 'VIEW_DOWNLOAD')),

    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    UNIQUE (doctor_id, patient_user_id)
);


-- =========================================================
-- 8. APPOINTMENTS
-- =========================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_profile_id UUID
        REFERENCES family_profiles(id) ON DELETE SET NULL,

    doctor_id UUID
        REFERENCES doctors(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,

    appointment_date DATE NOT NULL,
    appointment_time TIME,

    hospital_name VARCHAR(150),
    location TEXT,

    notes TEXT,

    reminder_minutes INTEGER DEFAULT 60
        CHECK (reminder_minutes >= 0),

    reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 9. VACCINATIONS
-- =========================================================

CREATE TABLE vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_profile_id UUID
        REFERENCES family_profiles(id) ON DELETE SET NULL,

    vaccine_name VARCHAR(150) NOT NULL,

    vaccination_date DATE NOT NULL,
    next_due_date DATE,

    dose_number INTEGER,

    hospital_name VARCHAR(150),

    notes TEXT,

    reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 10. TIMELINE EVENTS
-- =========================================================

CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_profile_id UUID
        REFERENCES family_profiles(id) ON DELETE SET NULL,

    event_type VARCHAR(50) NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    event_date DATE NOT NULL,

    source_type VARCHAR(50),
    source_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 11. REMINDERS
-- =========================================================

CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    family_profile_id UUID
        REFERENCES family_profiles(id) ON DELETE SET NULL,

    reminder_type VARCHAR(30) NOT NULL
        CHECK (reminder_type IN ('APPOINTMENT', 'VACCINATION', 'GENERAL')),

    title VARCHAR(255) NOT NULL,
    message TEXT,

    reminder_date DATE NOT NULL,
    reminder_time TIME,

    related_appointment_id UUID
        REFERENCES appointments(id) ON DELETE CASCADE,

    related_vaccination_id UUID
        REFERENCES vaccinations(id) ON DELETE CASCADE,

    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_sent BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 12. SECURE SHARING
-- =========================================================

CREATE TABLE shared_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    record_id UUID NOT NULL
        REFERENCES medical_records(id) ON DELETE CASCADE,

    shared_by UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    shared_with UUID
        REFERENCES users(id) ON DELETE CASCADE,

    share_token_hash TEXT UNIQUE,

    permission VARCHAR(30) NOT NULL DEFAULT 'VIEW'
        CHECK (permission IN ('VIEW', 'VIEW_DOWNLOAD')),

    expires_at TIMESTAMPTZ NOT NULL,

    max_access_count INTEGER,
    access_count INTEGER NOT NULL DEFAULT 0,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 13. SHARING ACCESS LOG
-- =========================================================

CREATE TABLE sharing_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shared_record_id UUID NOT NULL
        REFERENCES shared_records(id) ON DELETE CASCADE,

    accessed_by UUID
        REFERENCES users(id) ON DELETE SET NULL,

    ip_address INET,

    accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 14. EMERGENCY PROFILE
-- =========================================================

CREATE TABLE emergency_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    blood_group VARCHAR(10),

    allergies TEXT,
    chronic_conditions TEXT,

    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),

    emergency_notes TEXT,

    qr_token_hash TEXT UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 15. AUDIT LOGS
-- =========================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID
        REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(50),
    entity_id UUID,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 16. DEFAULT RECORD CATEGORIES
-- =========================================================

INSERT INTO record_categories (name, description) VALUES
('Prescription', 'Doctor prescriptions and medication documents'),
('Lab Report', 'Blood tests, urine tests and laboratory reports'),
('Medical Report', 'General medical reports'),
('Scan / Imaging', 'X-ray, MRI, CT, ultrasound and other imaging'),
('Discharge Summary', 'Hospital discharge documents'),
('Vaccination', 'Vaccination and immunization records'),
('Other', 'Other medical documents');


-- =========================================================
-- 17. INDEXES FOR SEARCH / PERFORMANCE
-- =========================================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_family_owner
ON family_profiles(owner_user_id);

CREATE INDEX idx_records_owner
ON medical_records(owner_user_id);

CREATE INDEX idx_records_family
ON medical_records(family_profile_id);

CREATE INDEX idx_records_category
ON medical_records(category_id);

CREATE INDEX idx_records_date
ON medical_records(record_date);

CREATE INDEX idx_records_doctor
ON medical_records(doctor_name);

CREATE INDEX idx_records_hospital
ON medical_records(hospital_name);

CREATE INDEX idx_appointments_owner
ON appointments(owner_user_id);

CREATE INDEX idx_appointments_date
ON appointments(appointment_date);

CREATE INDEX idx_vaccinations_owner
ON vaccinations(owner_user_id);

CREATE INDEX idx_vaccinations_due
ON vaccinations(next_due_date);

CREATE INDEX idx_timeline_owner_date
ON timeline_events(owner_user_id, event_date);

CREATE INDEX idx_reminders_date
ON reminders(reminder_date);

CREATE INDEX idx_shared_records_expiry
ON shared_records(expires_at);

CREATE INDEX idx_audit_user
ON audit_logs(user_id);

CREATE INDEX idx_audit_created
ON audit_logs(created_at);


-- =========================================================
-- DONE
-- =========================================================