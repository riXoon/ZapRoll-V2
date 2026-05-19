const eventModel = require('../models/eventModel');

const getAllEvents = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const events = await eventModel.getAllEvents(adminId);
    res.status(200).json({ status: 'success', data: events });
  } catch (err) {
    next(err);
  }
};

const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const event = await eventModel.getEventById(id, adminId);
    
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }
    
    res.status(200).json({ status: 'success', data: event });
  } catch (err) {
    next(err);
  }
};

const createEvent = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { 
      name, venue, event_date, total_capacity, quotas, 
      pre_reg_open, pre_reg_deadline, is_locked, evaluation_base_url
    } = req.body;
    
    // 1. Check if the user already has an event (Single-event rule)
    const existingEvents = await eventModel.getAllEvents(adminId);
    
    if (existingEvents && existingEvents.length > 0) {
      // If one exists, update it instead!
      const eventId = existingEvents[0].id;
      const updatedEvent = await eventModel.updateEvent(eventId, {
        name, venue, event_date, total_capacity, 
        pre_reg_open, pre_reg_deadline, is_locked, evaluation_base_url
      }, adminId, quotas);
      return res.status(200).json({ status: 'success', data: updatedEvent });
    }

    // 2. Otherwise, create the first one
    const newEvent = await eventModel.createEvent({
      name, venue, event_date, total_capacity, 
      pre_reg_open, pre_reg_deadline, is_locked, evaluation_base_url
    }, adminId, quotas);
    
    res.status(201).json({ status: 'success', data: newEvent });
  } catch (err) {
    next(err);
  }
};

const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { 
      name, venue, event_date, total_capacity, quotas, 
      pre_reg_open, pre_reg_deadline, is_locked, evaluation_base_url
    } = req.body;
    
    const updatedEvent = await eventModel.updateEvent(id, {
      name, venue, event_date, total_capacity, 
      pre_reg_open, pre_reg_deadline, is_locked, evaluation_base_url
    }, adminId, quotas);
    
    res.status(200).json({ status: 'success', data: updatedEvent });
  } catch (err) {
    next(err);
  }
};

const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    await eventModel.deleteEvent(id, adminId);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

const recordAttendance = async (req, res, next) => {
  try {
    const { eventId, participantId, sessionType } = req.body;
    
    if (!eventId || !participantId || !sessionType) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const attendance = await eventModel.recordAttendance(eventId, participantId, sessionType);
    
    res.status(200).json({ status: 'success', data: attendance });
  } catch (err) {
    next(err);
  }
};

const updateRegistrationSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { 
      student_am_link, 
      student_pm_link, 
      employee_reg_link,
      guest_reg_link,
      student_am_open,
      student_pm_open,
      employee_reg_open,
      guest_reg_open,
      walkin_student_link,
      walkin_student_open,
      walkin_employee_link,
      walkin_employee_open,
      walkin_guest_link,
      walkin_guest_open,
      am_eval_link,
      pm_eval_link,
      is_am_eval_open,
      is_pm_eval_open,
      poster_clearance_link,
      poster_clearance_open,
      poster_attendance_link,
      poster_attendance_open
    } = req.body;
    
    const updatedEvent = await eventModel.updateRegistrationSettings(id, adminId, {
      student_am_link,
      student_pm_link,
      employee_reg_link,
      guest_reg_link: guest_reg_link !== undefined ? guest_reg_link : walkin_guest_link,
      student_am_open,
      student_pm_open,
      employee_reg_open,
      guest_reg_open: guest_reg_open !== undefined ? guest_reg_open : walkin_guest_open,
      walkin_student_link,
      walkin_student_open,
      walkin_employee_link,
      walkin_employee_open,
      walkin_guest_link: walkin_guest_link !== undefined ? walkin_guest_link : guest_reg_link,
      walkin_guest_open: walkin_guest_open !== undefined ? walkin_guest_open : guest_reg_open,
      am_eval_link,
      pm_eval_link,
      is_am_eval_open,
      is_pm_eval_open,
      poster_clearance_link,
      poster_clearance_open,
      poster_attendance_link,
      poster_attendance_open
    });
    
    res.status(200).json({ status: 'success', data: updatedEvent });
  } catch (err) {
    next(err);
  }
};

const updateSessionStatus = async (req, res, next) => {
  try {
    const { id, type } = req.params;
    const { is_open } = req.body;
    
    const updatedSession = await eventModel.updateSessionStatus(id, type, is_open);
    res.status(200).json({ status: 'success', data: updatedSession });
  } catch (err) {
    next(err);
  }
};

const registerWalkin = async (req, res, next) => {
  try {
    const { eventId, fullName, email, quotaId, sessionType } = req.body;
    const adminId = req.user.id;
    
    if (!eventId || !fullName || !sessionType) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const registration = await eventModel.registerWalkin(eventId, adminId, {
      fullName,
      email,
      quotaId,
      sessionType
    });
    
    res.status(201).json({ status: 'success', data: registration });
  } catch (err) {
    next(err);
  }
};

const manualRegister = async (req, res, next) => {
  try {
    const { eventId, mode, role, sessionType, data } = req.body;
    const adminId = req.user.id;

    if (!eventId || !mode || !sessionType) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    let result;
    if (mode === 'pre-registered') {
      // Logic for Pre-registered
      result = await eventModel.findAndAttend(eventId, {
        externalId: data.externalId,
        fullName: data.fullName
      }, sessionType, true);
    } else {
      // Logic for Walk-in
      result = await eventModel.registerWalkin(eventId, adminId, {
        fullName: data.fullName,
        email: data.email,
        quotaId: data.quotaId,
        sessionType: sessionType,
        externalId: data.externalId,
        metadata: data.metadata
      });
    }

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

const getEvaluationTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessionType } = req.query;
    const template = await eventModel.getEvaluationTemplate(id, sessionType);
    res.status(200).json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
};

const saveEvaluationTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, questions, is_active, session_type } = req.body;
    
    const template = await eventModel.saveEvaluationTemplate(id, {
      title,
      questions,
      is_active,
      session_type
    });
    
    res.status(200).json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
};

const saveEvaluationResponse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { registration_id, session_id, responses, session_type } = req.body;
    
    const response = await eventModel.saveEvaluationResponse(id, {
      registration_id,
      session_id,
      responses,
      session_type
    });
    
    res.status(201).json({ status: 'success', data: response });
  } catch (err) {
    next(err);
  }
};

const getEvaluationResponses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // Check if event exists and admin owns it
    const event = await eventModel.getEventById(id, adminId);
    if (!event) {
      return res.status(404).json({ status: 'error', message: 'Event not found' });
    }

    const { sessionType } = req.query;
    const responses = await eventModel.getEvaluationResponses(id, sessionType);
    res.status(200).json({ status: 'success', data: responses });
  } catch (err) {
    next(err);
  }
};

const getCertificateWhitelist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const whitelist = await eventModel.getCertificateWhitelist(id);
    res.status(200).json({ status: 'success', data: whitelist });
  } catch (err) {
    next(err);
  }
};

const getPosterClearanceWhitelist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const whitelist = await eventModel.getPosterClearanceWhitelist(id);
    res.status(200).json({ status: 'success', data: whitelist });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  recordAttendance,
  registerWalkin,
  manualRegister,
  updateRegistrationSettings,
  updateSessionStatus,
  getEvaluationTemplate,
  saveEvaluationTemplate,
  saveEvaluationResponse,
  getEvaluationResponses,
  getCertificateWhitelist,
  getPosterClearanceWhitelist
};
