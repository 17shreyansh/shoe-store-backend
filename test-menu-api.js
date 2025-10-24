require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");
const Menu = require("./models/Menu");

const testMenuAPI = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Check categories
    console.log("\n=== CHECKING CATEGORIES ===");
    const categories = await Category.find().sort({ level: 1, name: 1 });
    console.log(`Found ${categories.length} categories:`);
    
    categories.forEach(cat => {
      console.log(`- ${cat.name} (slug: ${cat.slug}, level: ${cat.level}, ancestors: ${cat.ancestors.length})`);
    });

    // Check menus
    console.log("\n=== CHECKING MENUS ===");
    const menus = await Menu.find().populate('category', 'name slug level');
    console.log(`Found ${menus.length} menu items:`);
    
    menus.forEach(menu => {
      console.log(`- ${menu.name} -> ${menu.link} (Category: ${menu.category?.name || 'MISSING'}, Active: ${menu.isActive})`);
    });

    // Test menu creation if no menus exist and categories exist
    if (menus.length === 0 && categories.length > 0) {
      console.log("\n=== CREATING TEST MENU ITEMS ===");
      
      for (let i = 0; i < Math.min(3, categories.length); i++) {
        const category = categories[i];
        
        // Generate link
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

        const menu = new Menu({
          name: category.name,
          link: link,
          category: category._id,
          order: i,
          isActive: true
        });

        await menu.save();
        console.log(`Created menu: ${menu.name} -> ${menu.link}`);
      }
    }

    // Final check
    console.log("\n=== FINAL MENU CHECK ===");
    const finalMenus = await Menu.find({ isActive: true })
      .populate('category', 'name slug level')
      .sort({ order: 1 });
    
    console.log(`Active menus: ${finalMenus.length}`);
    finalMenus.forEach(menu => {
      console.log(`- ${menu.name} -> ${menu.link} (Order: ${menu.order})`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

testMenuAPI();