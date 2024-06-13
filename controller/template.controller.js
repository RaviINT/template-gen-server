const { Image_Link, UploadFile } = require("../utils/s3-config");

module.exports = {
  addVideoTemplate: async (req, res) => {
    req.files.map(async (video) => {
      let key = `Video_Templates/${video.originalname}`;
      await UploadFile(key, {
        buffer: video.buffer,
        mimetype: video.mimetype,
      });
    });

    return res.status(200).send("success");
  },
  addImageTemplate: async (req, res) => {
    req.files.map(async (image) => {
      let key = `Image_Templates/${image.originalname}`;
      await UploadFile(key, {
        buffer: image.buffer,
        mimetype: image.mimetype,
      });
    });

    return res.status(200).send("success");
  },
  getVideoTemplate: async (req, res) => {
    let arr = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map(async (item) => {
        let url = await Image_Link(`Video_Templates/template_${item}.mp4`);
        arr.push(url);
      })
    );
    return res.status(200).send(arr);
  },
  getImageTemplate: async (req, res) => {
    let arr = [];
    await Promise.all(
      [1, 2, 3].map(async (item) => {
        let url = await Image_Link(`Image_Templates/card_background_${item}.jpg`);
        arr.push(url);
      })
    );
    return res.status(200).send(arr);
  },
};
