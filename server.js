const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WildShield Fast2SMS Server Running...");
});

app.post("/send-sms", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: "Phone number and message are required!",
      });
    }

    if (!process.env.FAST2SMS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "FAST2SMS_API_KEY is missing in .env file!",
      });
    }

    // Fast2SMS URL (GET request format)
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${
      process.env.FAST2SMS_API_KEY
    }&route=q&message=${encodeURIComponent(
      message
    )}&language=english&numbers=${phone}`;

    const response = await axios.get(url);

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.log("FAST2SMS ERROR:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.response ? error.response.data : error.message,
    });
  }
});

app.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});