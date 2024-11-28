const Cronofy = require("cronofy");
const dotenv = require("dotenv");

dotenv.config();

const cronofyClient = new Cronofy({
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  data_center: process.env.DATA_CENTER,
  access_token: process.env.ACCESS_TOKEN,
  oauth: {
    redirect_uri: process.env.ORIGIN,
  },
});

module.exports = cronofyClient;
