const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/database");


// Generate access token
const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "15m"
        }
    );
};


// Generate refresh token
const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};


// Hash refresh token before storing it
const hashToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};


// Register User
const register = async (req, res) => {
    try {
        const {
            full_name,
            email,
            password,
            phone,
            date_of_birth,
            gender
        } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required"
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
                (full_name, email, password_hash, phone, date_of_birth, gender)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING
                id,
                full_name,
                email,
                role,
                phone,
                date_of_birth,
                gender,
                created_at`,
            [
                full_name,
                email,
                passwordHash,
                phone || null,
                date_of_birth || null,
                gender || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
};


// Login User
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                full_name,
                email,
                password_hash,
                role,
                phone,
                date_of_birth,
                gender,
                is_active
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Access token
        const accessToken = generateAccessToken(user);

        // Refresh token
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        // Store hashed refresh token
        await pool.query(
            `INSERT INTO refresh_tokens
                (user_id, token_hash, expires_at)
             VALUES
                ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
            [
                user.id,
                refreshTokenHash
            ]
        );

        delete user.password_hash;

        res.json({
            success: true,
            message: "Login successful",
            accessToken,
            refreshToken,
            user
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
};


// Refresh access token
const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const tokenHash = hashToken(refreshToken);

        const result = await pool.query(
            `SELECT
                rt.id,
                rt.user_id,
                u.role,
                u.is_active
             FROM refresh_tokens rt
             JOIN users u
                ON rt.user_id = u.id
             WHERE rt.token_hash = $1
               AND rt.revoked_at IS NULL
               AND rt.expires_at > CURRENT_TIMESTAMP`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        const tokenRecord = result.rows[0];

        if (!tokenRecord.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive"
            });
        }

        const accessToken = jwt.sign(
            {
                userId: tokenRecord.user_id,
                role: tokenRecord.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "15m"
            }
        );

        res.json({
            success: true,
            accessToken
        });

    } catch (error) {
        console.error("Refresh token error:", error);

        res.status(500).json({
            success: false,
            message: "Server error while refreshing token"
        });
    }
};


// Logout
const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const tokenHash = hashToken(refreshToken);

        await pool.query(
            `UPDATE refresh_tokens
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE token_hash = $1`,
            [tokenHash]
        );

        res.json({
            success: true,
            message: "Logout successful"
        });

    } catch (error) {
        console.error("Logout error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during logout"
        });
    }
};


module.exports = {
    register,
    login,
    refreshAccessToken,
    logout
};