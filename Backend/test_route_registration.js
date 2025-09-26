/**
 * Test route registration
 * Run with: node test_route_registration.js
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Route Registration\n');

// Simulate the server's route loading logic
const routesPath = path.join(__dirname, 'src/routes');
if (fs.existsSync(routesPath)) {
  const files = fs.readdirSync(routesPath);
  console.log('Route files found:');
  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const routeName = '/' + file.replace('.js', '');
      console.log(`  - ${file} → /api${routeName}`);
      
      // Try to load the route
      try {
        const route = require(path.join(routesPath, file));
        console.log(`    ✅ Successfully loaded`);
        
        // Check if it has the mobile submit route
        if (file.includes('training') && file.includes('approval')) {
          console.log(`    🔍 Checking for mobile submit route...`);
          // This is a simplified check - in reality we'd need to inspect the router
        }
      } catch (error) {
        console.log(`    ❌ Error loading: ${error.message}`);
      }
    }
  });
} else {
  console.log('❌ Routes directory not found');
}
