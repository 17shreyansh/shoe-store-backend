const Brand = require("../models/Brand");

// @desc    Create a new brand
// @route   POST /api/brands
// @access  Private/Admin
exports.createBrand = async (req, res) => {
  try {
    const brand = new Brand(req.body);
    await brand.save();
    res.status(201).json(brand);
  } catch (err) {
    console.error("Error creating brand:", err);
    if (err.code === 11000) {
      res.status(400).json({ error: "Brand name already exists" });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
};

// @desc    Get all brands
// @route   GET /api/brands
// @access  Public
exports.getBrands = async (req, res) => {
  try {
    const { active } = req.query;
    let query = {};
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const brands = await Brand.find(query).sort({ name: 1 });
    res.json(brands);
  } catch (err) {
    console.error("Error fetching brands:", err);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
};

// @desc    Get single brand by ID
// @route   GET /api/brands/:id
// @access  Public
exports.getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json(brand);
  } catch (err) {
    console.error("Error fetching brand:", err);
    res.status(500).json({ error: "Failed to fetch brand" });
  }
};

// @desc    Get brand by slug
// @route   GET /api/brands/by-slug/:slug
// @access  Public
exports.getBrandBySlug = async (req, res) => {
  try {
    const brand = await Brand.findOne({ slug: req.params.slug });
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json(brand);
  } catch (err) {
    console.error("Error fetching brand by slug:", err);
    res.status(500).json({ error: "Failed to fetch brand" });
  }
};

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private/Admin
exports.updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      {
        new: true,
        runValidators: true,
      }
    );
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json(brand);
  } catch (err) {
    console.error("Error updating brand:", err);
    if (err.code === 11000) {
      res.status(400).json({ error: "Brand name already exists" });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
};

// @desc    Delete a brand
// @route   DELETE /api/brands/:id
// @access  Private/Admin
exports.deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json({ message: "Brand deleted successfully" });
  } catch (err) {
    console.error("Error deleting brand:", err);
    res.status(500).json({ error: "Failed to delete brand" });
  }
};