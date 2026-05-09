const healthModel = require('../models/healthModel');

const getHealthStatus = async (req, res, next) => {
  try {
    const dbStatus = await healthModel.checkDatabaseConnection();
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      services: {
        api: 'online',
        database: dbStatus.connected ? 'online' : 'offline',
        databaseMessage: dbStatus.message
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHealthStatus
};
