// This file is executed by Jest's `setupFiles` configuration.
// It runs before the test environment is set up.
// Its purpose is to load environment variables from the .env.test file
// at the earliest possible moment, ensuring they are available to all modules.

const dotenv = require('dotenv');
dotenv.config({ path: '.env.test' });
