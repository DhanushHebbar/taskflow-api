const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Helper function to generate both tokens
const generateTokens = (user) => {
  const payload = { user: { id: user.id, role: user.role } };
  
  // Short-lived Access Token (15 minutes)
  const accessToken = jwt.sign(
    payload, 
    process.env.JWT_SECRET || 'fallback_secret', 
    { expiresIn: '15m' }
  );

  // Long-lived Refresh Token (7 days)
  const refreshToken = jwt.sign(
    payload, 
    process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret', 
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate both tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Return 'token' to map to existing frontend logic, plus the new refreshToken
    res.status(201).json({ 
      token: accessToken, 
      refreshToken, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // Generate both tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({ 
      token: accessToken, 
      refreshToken, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/auth/refresh
// @desc    Get new access token using a valid refresh token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    // Verify the refresh token using a dedicated secret
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret');
    
    // Generate a fresh access token (15 mins)
    const payload = { user: { id: decoded.user.id, role: decoded.user.role } };
    const newAccessToken = jwt.sign(
      payload, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '15m' }
    );

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(401).json({ message: 'Invalid or expired refresh token. Please log in again.' });
  }
});

module.exports = router;
