const express = require("express");
const { getVideoTemplate, getImageTemplate, addVideoTemplate, addImageTemplate } = require("../controller/template.controller");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.get("/getVideoTemplate", getVideoTemplate);
router.get("/getImageTemplate", getImageTemplate);

router.post("/addVideoTemplate", upload.any(), addVideoTemplate);
router.post("/addImageTemplate", upload.any(), addImageTemplate);

module.exports = router;
