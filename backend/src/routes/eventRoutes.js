const express = require('express');
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All event routes are protected by authMiddleware
router.use(authMiddleware);

router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.patch('/:id', eventController.updateEvent);
router.patch('/:id/registration-settings', eventController.updateRegistrationSettings);
router.patch('/:id/sessions/:type/status', eventController.updateSessionStatus);
router.delete('/:id', eventController.deleteEvent);
router.post('/record-attendance', eventController.recordAttendance);
router.post('/walkin', eventController.registerWalkin);
router.post('/manual-register', eventController.manualRegister);

module.exports = router;
