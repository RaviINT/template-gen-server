const express = require("express");

const router = express.Router();

const multer = require("multer");
const { editVideo } = require("../controller/video.controller");
const upload = multer({ dest: "uploads/" });

router.post("/edit-video", upload.single("image"), editVideo);

module.exports = router;
