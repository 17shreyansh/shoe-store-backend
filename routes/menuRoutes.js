const express = require("express");
const router = express.Router();
const {
  getAllMenus,
  getAllMenusAdmin,
  createMenu,
  updateMenu,
  deleteMenu,
} = require("../controllers/menuController");
const { protect, isAdmin } = require("../middleware/authMiddleware");


// Public routes
router.get("/", getAllMenus);

// Admin routes (add your auth middleware here)
// router.use(requireAuth); // Uncomment and add your auth middleware
router.get("/admin", protect, isAdmin, getAllMenusAdmin);
router.post("/",protect, isAdmin,createMenu);
router.put("/:id",protect, isAdmin, updateMenu);
router.delete("/:id",protect, isAdmin, deleteMenu);

module.exports = router;