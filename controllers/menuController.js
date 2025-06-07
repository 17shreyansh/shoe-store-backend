const Menu = require("../models/Menu");
const Category = require("../models/Category");

// Get all menu items
const getAllMenus = async (req, res) => {
  try {
    const menus = await Menu.find({ isActive: true })
      .populate('category', 'name slug')
      .sort({ order: 1 });
    
    res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    console.error("Error fetching menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
    });
  }
};

// Get all menu items for admin (including inactive)
const getAllMenusAdmin = async (req, res) => {
  try {
    const menus = await Menu.find()
      .populate('category', 'name slug ancestors level')
      .sort({ order: 1 });
    
    res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    console.error("Error fetching admin menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
    });
  }
};

// Create new menu item
const createMenu = async (req, res) => {
  try {
    const { name, categoryId, order } = req.body;

    // Validate required fields
    if (!name || !categoryId) {
      return res.status(400).json({
        success: false,
        message: "Name and category are required",
      });
    }

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Generate link based on category hierarchy
    const link = await generateCategoryLink(categoryId);

    // Create menu item
    const menu = new Menu({
      name,
      link,
      category: categoryId,
      order: order || 0,
    });

    await menu.save();
    await menu.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      data: menu,
      message: "Menu item created successfully",
    });
  } catch (error) {
    console.error("Error creating menu:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create menu item",
    });
  }
};

// Update menu item
const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId, order, isActive } = req.body;

    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // If category is being changed, validate and update link
    if (categoryId && categoryId !== menu.category.toString()) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
      menu.category = categoryId;
      menu.link = await generateCategoryLink(categoryId);
    }

    // Update other fields
    if (name) menu.name = name;
    if (order !== undefined) menu.order = order;
    if (isActive !== undefined) menu.isActive = isActive;

    await menu.save();
    await menu.populate('category', 'name slug');

    res.status(200).json({
      success: true,
      data: menu,
      message: "Menu item updated successfully",
    });
  } catch (error) {
    console.error("Error updating menu:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update menu item",
    });
  }
};

// Delete menu item
const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    await Menu.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting menu:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete menu item",
    });
  }
};

// Helper function to generate category link
const generateCategoryLink = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId).populate('ancestors');
    
    if (!category) {
      throw new Error("Category not found");
    }

    // Build the path from ancestors
    let path = "/category";
    
    // Add ancestor slugs
    if (category.ancestors && category.ancestors.length > 0) {
      for (const ancestor of category.ancestors) {
        path += `/${ancestor.slug}`;
      }
    }
    
    // Add current category slug
    path += `/${category.slug}`;
    
    return path;
  } catch (error) {
    console.error("Error generating category link:", error);
    throw error;
  }
};

module.exports = {
  getAllMenus,
  getAllMenusAdmin,
  createMenu,
  updateMenu,
  deleteMenu,
};