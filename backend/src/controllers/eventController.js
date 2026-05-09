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
    const { name, venue, event_date, total_capacity, quotas } = req.body;
    
    // 1. Check if the user already has an event (Single-event rule)
    const existingEvents = await eventModel.getAllEvents(adminId);
    
    if (existingEvents && existingEvents.length > 0) {
      // If one exists, update it instead!
      const eventId = existingEvents[0].id;
      const updatedEvent = await eventModel.updateEvent(eventId, {
        name, venue, event_date, total_capacity
      }, adminId, quotas);
      return res.status(200).json({ status: 'success', data: updatedEvent });
    }

    // 2. Otherwise, create the first one
    const newEvent = await eventModel.createEvent({
      name, venue, event_date, total_capacity
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
    const { name, venue, event_date, total_capacity, quotas } = req.body;
    
    const updatedEvent = await eventModel.updateEvent(id, {
      name, venue, event_date, total_capacity
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

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
