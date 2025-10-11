const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// GET /api/search/suggestions
router.get('/suggestions', searchController.getSearchSuggestions);

module.exports = router;