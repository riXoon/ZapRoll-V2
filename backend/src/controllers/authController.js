const authModel = require('../models/authModel');

const getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user; // Attached by authMiddleware
    const profile = await authModel.getProfileByUserId(user.id);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        profile
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCurrentUser
};
