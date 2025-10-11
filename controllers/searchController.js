const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");

// @desc    Get search suggestions
// @route   GET /api/search/suggestions
// @access  Public
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    
    const searchRegex = new RegExp(q, 'i');
    const limit = 5; // Limit results per category
    
    // Run queries in parallel
    const [products, categories, brands] = await Promise.all([
      Product.find({ name: searchRegex })
        .select('name slug')
        .limit(limit),
      
      Category.find({ name: searchRegex })
        .select('name slug')
        .limit(limit),
      
      Brand.find({ name: searchRegex })
        .select('name slug')
        .limit(limit)
    ]);
    
    // Format suggestions
    const suggestions = [
      // Add direct search term suggestion
      { type: 'search', term: q },
      
      // Add product suggestions
      ...products.map(product => ({
        type: 'product',
        id: product._id,
        name: product.name,
        slug: product.slug
      })),
      
      // Add category suggestions
      ...categories.map(category => ({
        type: 'category',
        id: category._id,
        name: category.name,
        slug: category.slug
      })),
      
      // Add brand suggestions
      ...brands.map(brand => ({
        type: 'brand',
        id: brand._id,
        name: brand.name,
        slug: brand.slug
      }))
    ];
    
    // Get popular search tags (could be from a cache or database)
    const popularTags = ['shoes', 'sneakers', 'boots', 'running', 'casual']
      .filter(tag => tag.includes(q.toLowerCase()))
      .map(tag => ({ type: 'tag', name: tag }));
    
    res.json({ 
      suggestions: [...suggestions, ...popularTags].slice(0, 10) // Limit total suggestions
    });
    
  } catch (err) {
    console.error("Error fetching search suggestions:", err);
    res.status(500).json({ error: "Failed to fetch search suggestions" });
  }
};