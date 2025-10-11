const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Mellotoes Backend...\n');

// Run admin seed first
console.log('📝 Creating admin user...');
const seedProcess = spawn('node', ['seeds/adminSeed.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

seedProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Admin user ready\n');
    console.log('🔐 Admin Credentials:');
    console.log('   Email: admin@mellotoes.com');
    console.log('   Password: admin123\n');
    
    // Start the main server
    console.log('🌐 Starting server...');
    const serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    serverProcess.on('close', (serverCode) => {
      process.exit(serverCode);
    });
  } else {
    console.error('❌ Failed to create admin user');
    process.exit(1);
  }
});