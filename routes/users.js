const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer Storage for Avatars
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'taskflow_avatars',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }] // Auto-crop to perfect square!
  },
});
const upload = multer({ storage: storage });

// @route   GET /api/users/me
// @desc    Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/users/profile
// @desc    Update profile name and/or avatar
router.put('/profile', auth, upload.single('avatar'), async (req, res) => {
  try {
    const { name } = req.body;
    let user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update name if provided
    if (name) user.name = name;

    // Update avatar if a file was uploaded
    if (req.file) {
      user.avatar = req.file.path;
    }

    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(req.user.id).select('-password');
    res.json(updatedUser);
  } catch (err) {
    console.error('Profile Update Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
