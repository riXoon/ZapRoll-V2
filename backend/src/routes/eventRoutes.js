const express = require('express');
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public Evaluation Routes (Accessed by website participants)
router.get('/:id/evaluation-template', eventController.getEvaluationTemplate);
router.post('/:id/evaluation-responses', eventController.saveEvaluationResponse);

// Protected Routes
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

// Evaluation Design Routes (Protected)
router.get('/:id/evaluation-responses', eventController.getEvaluationResponses);
router.get('/:id/certificate-whitelist', eventController.getCertificateWhitelist);
router.get('/:id/poster-clearance-whitelist', eventController.getPosterClearanceWhitelist);
router.post('/:id/evaluation-template', eventController.saveEvaluationTemplate);

module.exports = router;
