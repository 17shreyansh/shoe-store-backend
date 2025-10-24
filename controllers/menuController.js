const Menu = require("../models/Menu");
const Category = require("../models/Category");

// Get all menu items - dynamically from categories
const getAllMenus = async (req, res) => {
  try {
    // Get all active categories sorted by level and name
    const categories = await Category.find()
      .sort({ level: 1, name: 1 });
    
    // Generate menu items from categories
    const menus = [];
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      
      // Generate link for category
      let link = "/category";
      
      if (category.ancestors && category.ancestors.length > 0) {
        const ancestors = await Category.find({
          '_id': { $in: category.ancestors }
        }).sort({ level: 1 });
        
        for (const ancestor of ancestors) {
          link += `/${ancestor.slug}`;
        }
      }
      
      link += `/${category.slug}`;
      
      menus.push({
        _id: category._id,
        name: category.name,
        link: link,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          level: category.level
        },
        order: i,
        isActive: true
      });
    }
    
    res.status(200).json({
      success: true,
      data: menus,
      count: menus.length
    });
  } catch (error) {
    console.error("Error fetching menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
      error: error.message
    });
  }
};

// Get all menu items for admin - dynamically from categories
const getAllMenusAdmin = async (req, res) => {
  try {
    // Get all categories (including inactive ones if needed)
    const categories = await Category.find()
      .sort({ level: 1, name: 1 });
    
    // Generate menu items from categories
    const menus = [];
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      
      // Generate link for category
      let link = "/category";
      
      if (category.ancestors && category.ancestors.length > 0) {
        const ancestors = await Category.find({
          '_id': { $in: category.ancestors }
        }).sort({ level: 1 });
        
        for (const ancestor of ancestors) {
          link += `/${ancestor.slug}`;
        }
      }
      
      link += `/${category.slug}`;
      
      menus.push({
        _id: category._id,
        name: category.name,
        link: link,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          level: category.level,
          ancestors: category.ancestors
        },
        order: i,
        isActive: true
      });
    }
    
    res.status(200).json({
      success: true,
      data: menus,
      count: menus.length
    });
  } catch (error) {
    console.error("Error fetching admin menus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch menu items",
      error: error.message
    });
  }
};

// Create new menu item (now creates a category instead)
const createMenu = async (req, res) => {
  try {
    const { name, parentId, description } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Check if parent category exists (if provided)
    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    // Create new category
    const category = new Category({
      name,
      description: description || '',
      parent: parentId || null,
    });

    await category.save();

    // Generate link for the new category
    const link = await generateCategoryLink(category._id);

    res.status(201).json({
      success: true,
      data: {
        _id: category._id,
        name: category.name,
        link: link,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          level: category.level
        },
        order: 0,
        isActive: true
      },
      message: "Category created successfully",
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message
    });
  }
};

// Update menu item (now updates category)
const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parentId } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if parent category exists (if provided)
    if (parentId && parentId !== category.parent?.toString()) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }
      category.parent = parentId;
    }

    // Update other fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;

    await category.save();

    // Generate updated link
    const link = await generateCategoryLink(category._id);

    res.status(200).json({
      success: true,
      data: {
        _id: category._id,
        name: category.name,
        link: link,
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          level: category.level
        },
        order: 0,
        isActive: true
      },
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message
    });
  }
};

// Delete menu item (now deletes category)
const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has children
    const childCategories = await Category.find({ parent: id });
    if (childCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category with subcategories",
      });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message
    });
  }
};

// Helper function to generate category link
const generateCategoryLink = async (categoryId) => {
  try {
    const category = await Category.findById(categoryId);
    
    if (!category) {
      throw new Error("Category not found");
    }

    // Build the path from ancestors
    let path = "/category";
    
    // Add ancestor slugs if they exist
    if (category.ancestors && category.ancestors.length > 0) {
      // Get all ancestor categories
      const ancestors = await Category.find({
        '_id': { $in: category.ancestors }
      }).sort({ level: 1 });
      
      for (const ancestor of ancestors) {
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