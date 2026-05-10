const dotenv = require('dotenv');
console.log("Calling dotenv.config()...");
const result = dotenv.config();
console.log("Result:", result);
console.log("Process ENV (sample):", process.env.PORT);
