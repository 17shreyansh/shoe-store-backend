require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");
const Menu = require("./models/Menu");

const fixMenuData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find menus with missing categories
    const menusWithMissingCategories = await Menu.find().populate('category');
    const brokenMenus = menusWithMissingCategories.filter(menu => !menu.category);
    
    console.log(`Found ${brokenMenus.length} menus with missing categories:`);
    brokenMenus.forEach(menu => {
      console.log(`- ${menu.name} (ID: ${menu._id})`);
    });

    if (brokenMenus.length > 0) {
      console.log("\nRemoving broken menu items...");
      const result = await Menu.deleteMany({
        _id: { $in: brokenMenus.map(menu => menu._id) }
      });
      console.log(`Deleted ${result.deletedCount} broken menu items`);
    }

    // Get existing categories
    const categories = await Category.find().sort({ level: 1, name: 1 });
    console.log(`\nFound ${categories.length} valid categories:`);
    categories.forEach(cat => {
      console.log(`- ${cat.name} (slug: ${cat.slug}, level: ${cat.level})`);
    });

    // Create proper menu items for existing categories
    console.log("\nCreating menu items for existing categories...");
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      
      // Check if menu already exists for this category
      const existingMenu = await Menu.findOne({ category: category._id });
      if (existingMenu) {
        console.log(`Menu already exists for ${category.name}`);
        continue;
      }

      // Generate proper link
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

    // Final verification
    console.log("\n=== FINAL VERIFICATION ===");
    const finalMenus = await Menu.find({ isActive: true })
      .populate('category', 'name slug level')
      .sort({ order: 1 });
    
    console.log(`Total active menus: ${finalMenus.length}`);
    finalMenus.forEach(menu => {
      console.log(`✓ ${menu.name} -> ${menu.link} (Category: ${menu.category.name})`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

fixMenuData();