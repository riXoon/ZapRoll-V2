const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protected route to get the current user's profile
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
