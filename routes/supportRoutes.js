const express = require('express');
const router = express.Router();
const {
  createTicket,
  getUserTickets,
  getAllTickets,
  getTicket,
  updateTicket,
  addMessage,
  assignTicket,
  closeTicket,
  deleteTicket
} = require('../controllers/supportController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// User routes
router.route('/')
  .post(protect, createTicket)
  .get(protect, getUserTickets);

router.route('/:id')
  .get(protect, getTicket)
  .put(protect, updateTicket)
  .delete(protect, isAdmin, deleteTicket);

router.route('/:id/messages')
  .post(protect, addMessage);

router.route('/:id/close')
  .put(protect, closeTicket);

// Admin routes
router.route('/admin/all')
  .get(protect, isAdmin, getAllTickets);

router.route('/:id/assign')
  .put(protect, isAdmin, assignTicket);

module.exports = router;