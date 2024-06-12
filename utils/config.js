const dotenv = require("dotenv");
dotenv.config();
const config = {
  access_key: process.env.ACCESS_KEY,
  secret_key: process.env.SECRET_KEY,
  bucket_name: process.env.BUCKET_NAME,
  bucket_region: process.env.BUCKET_REGION,
};
module.exports = config;
