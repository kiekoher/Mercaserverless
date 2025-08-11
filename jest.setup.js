// Load environment variables from .env.local for Jest
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');
