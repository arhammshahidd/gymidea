require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

// Auto-load routes in src/routes (mounted under /api/<filename-without-.js>)
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach((file) => {
    if (file.endsWith('.js')) {
      const route = require(path.join(routesPath, file));
      const routeName = '/' + file.replace('.js', ''); // e.g. auth.js -> /auth
      app.use('/api' + routeName, route);
      console.log(`Loaded route: /api${routeName}`);
    }
  });
}

app.get('/', (req, res) => res.json({ message: 'Gym Backend API is running 🚀' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
