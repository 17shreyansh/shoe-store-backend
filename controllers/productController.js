const Product = require("../models/Product");
const mongoose = require('mongoose');

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    
    // Populate brand and categories for response
    await product.populate([
      { path: 'brand', select: 'name logo' },
      { path: 'categories', select: 'name' }
    ]);
    
    res.status(201).json(product);
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(400).json({ error: err.message });
  }
};

// @desc    Get all products with filtering, sorting, and search
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { 
      category, 
      brand, 
      material, 
      color, 
      size,
      gender, 
      minPrice, 
      maxPrice, 
      sortBy, 
      search,
      inStock 
    } = req.query;
    
    let query = {};

    if (category) query.categories = { $in: [category] };
    if (brand) query.brand = brand;
    if (gender) query.gender = gender;
    
    // Handle multiple selections using $in operator
    if (material) {
      const materialsArray = material.split(',').map(m => new RegExp(m.trim(), 'i'));
      query.material = { $in: materialsArray };
    }
    
    if (color) {
      const colorsArray = color.split(',').map(c => c.trim());
      query.availableColors = { $in: colorsArray };
    }
    
    if (size) {
      const sizesArray = size.split(',').map(s => parseFloat(s.trim()));
      query.availableSizes = { $in: sizesArray };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      query.totalStock = { $gt: 0 };
    }

    // Enhanced search functionality
    if (search) {
      const searchTerms = search.split(' ').filter(term => term.length > 0);
      
      if (searchTerms.length > 0) {
        // Create an array of conditions for each search term
        const searchConditions = searchTerms.map(term => ({
          $or: [
            { name: new RegExp(term, 'i') },
            { description: new RegExp(term, 'i') },
            { material: new RegExp(term, 'i') },
            { 'brand.name': new RegExp(term, 'i') },
            { 'categories.name': new RegExp(term, 'i') },
            { gender: new RegExp(term, 'i') },
            { tags: new RegExp(term, 'i') }
          ]
        }));
        
        // Use $and to require all search terms to match
        query.$and = searchConditions;
      }
    }

    let productsQuery = Product.find(query)
      .populate("categories", "name")
      .populate("brand", "name logo");

    // Sorting
    if (sortBy === "priceAsc") productsQuery = productsQuery.sort({ price: 1 });
    else if (sortBy === "priceDesc") productsQuery = productsQuery.sort({ price: -1 });
    else if (sortBy === "nameAsc") productsQuery = productsQuery.sort({ name: 1 });
    else if (sortBy === "stockDesc") productsQuery = productsQuery.sort({ totalStock: -1 });
    else productsQuery = productsQuery.sort({ createdAt: -1 });

    const products = await productsQuery.exec();
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

// @desc    Get single product by ID or slug
// @route   GET /api/products/:identifier
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const { identifier } = req.params;
    let product;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier)
        .populate("categories", "name")
        .populate("brand", "name logo");
    } else {
      product = await Product.findOne({ slug: identifier })
        .populate("categories", "name")
        .populate("brand", "name logo");
    }

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate([
      { path: 'brand', select: 'name logo' },
      { path: 'categories', select: 'name' }
    ]);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(400).json({ error: err.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
};

// @desc    Update stock for specific variant
// @route   PATCH /api/products/:id/stock
// @access  Private/Admin
exports.updateVariantStock = async (req, res) => {
  try {
    const { size, color, stock } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updated = product.updateVariantStock(size, color, stock);
    if (!updated) {
      return res.status(404).json({ message: "Variant not found" });
    }

    await product.save();
    res.json({ message: "Stock updated successfully", totalStock: product.totalStock });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(400).json({ error: err.message });
  }
};

// @desc    Get stock for specific variant
// @route   GET /api/products/:id/stock/:size/:color
// @access  Public
exports.getVariantStock = async (req, res) => {
  try {
    const { size, color } = req.params;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const stock = product.getStockForVariant(parseFloat(size), color);
    res.json({ size: parseFloat(size), color, stock });
  } catch (err) {
    console.error("Error fetching variant stock:", err);
    res.status(500).json({ error: "Failed to fetch variant stock" });
  }
};