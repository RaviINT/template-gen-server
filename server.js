const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
// const ffprobe = require("fluent-ffmpeg").ffprobe;
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const { s3, UploadFile, Image_Link } = require("./s3-config"); // Import your S3 utilities
const { default: axios } = require("axios");
const ffprobeStatic = require("ffprobe-static");
const { exec } = require("child_process");
// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);
app.use("/fonts", express.static(path.join(__dirname, "fonts")));

app.get("/getVideoTemplate", async (req, res) => {
  let arr = [];
  await Promise.all(
    [1, 2, 3].map(async (item) => {
      let url = await Image_Link(`Templates/Template_${item}.mp4`);
      arr.push(url);
    })
  );
  return res.status(200).send(arr);
});
app.get("/getImageTemplate", async (req, res) => {
  let arr = [];
  await Promise.all(
    [1, 2, 3].map(async (item) => {
      let url = await Image_Link(`Image_Templates/card_background_${item}.jpg`);
      arr.push(url);
    })
  );
  return res.status(200).send(arr);
});

async function downloadFile(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

app.post("/edit-video", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;
  const videoUrl = req.body.videoUrl;

  const videoPath = `temp/${Date.now()}_video.mp4`;
  const videoPath2 = `temp/${Date.now()}_video2.mp4`;
  const outputPath = `output/${Date.now()}_output.mp4`;

  // Ensure the output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Step 1: Create a 2-second video from the image
  let command1 = ffmpeg()
    .input(imagePath)
    .loop(2)
    .outputOptions("-vf", "scale=640:480") // Set video resolution
    .output(videoPath)
    .on("end", async () => {
      try {
        let videoUrl2 = videoUrl;

        await downloadFile(videoUrl2, videoPath2);

        // Execute ffmpeg command
        exec(
          `ffmpeg -i ${videoPath} -i ${videoPath2} -filter_complex "[0:v]scale=640:480,setsar=1[v0];[1:v]scale=640:480,setsar=1[v1];[v0][v1]concat=n=2:v=1[outv]" -map "[outv]" ${outputPath}`,
          async (error, stdout, stderr) => {
            if (error) {
              console.error("Error merging videos:", error.message);
              res.status(500).send("Error merging videos");
              return;
            }

            console.log("Videos merged successfully");

            const fileBuffer = fs.readFileSync(outputPath);
            const s3Key = `videos/${Date.now()}_output.mp4`;
            try {
              const url = await UploadFile(s3Key, {
                buffer: fileBuffer,
                mimetype: "video/mp4",
              });
              // Clean up local files

              fs.unlinkSync(videoPath);
              fs.unlinkSync(videoPath2);
              fs.unlinkSync(outputPath);
              fs.unlinkSync(imagePath);

              res.json({ url }); // Send the pre-signed URL to the frontend
            } catch (err) {
              fs.unlinkSync(videoPath);
              fs.unlinkSync(videoPath2);

              console.error("Error uploading to S3:", err);
              res.status(500).send("Error processing video");
            }
          }
        );
      } catch (error) {
        fs.unlinkSync(outputPath);
        fs.unlinkSync(imagePath);
        console.error("Error processing request:", error);
        res.status(500).send("Error processing request");
      }
    })
    .on("error", (err) => {
      console.error("Error during video creation from image:", err);
      res.status(500).send("Error processing video");
    });

  command1.run();
});
// app.post("/edit-video", upload.single("image"), async (req, res) => {
//   const videoPath = req.body.video; // Hardcoded video path
//   const imagePath = req.file.path; // Image path from uploaded file
//   const text = req.body.name; // Name from the request body
//   console.log("Dr Name", text);
//   // Hardcoded text and positions
//   const textX = 400;
//   const textY = 250;
//   const textStart = 0;
//   const textDuration = 2.5;

//   // Hardcoded image positions and timings
//   const imageX = 400;
//   const imageY = 430;
//   const imageStart = 0;
//   const imageDuration = 2.5;

//   const intermediatePath = `output/${Date.now()}_intermediate.mp4`;
//   const outputPath = `output/${Date.now()}_output.mp4`;

//   // Ensure the output directory exists
//   const outputDir = path.dirname(outputPath);
//   if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }

//   // Step 1: Add image overlay
//   let command1 = ffmpeg()
//     .input(videoPath) // Specify video input
//     .input(imagePath) // Specify image input
//     .complexFilter([
//       {
//         filter: "overlay",
//         options: {
//           x: imageX,
//           y: imageY,
//           enable: `between(t,${imageStart},${imageDuration})`,
//         },
//       },
//     ])
//     .output(intermediatePath)
//     .on("end", () => {
//       console.log("Step 1: Image overlay added");

//       // Step 2: Add text overlay to the intermediate video
//       let command2 = ffmpeg()
//         .input(intermediatePath) // Specify intermediate video input
//         .complexFilter([
//           {
//             filter: "drawtext",
//             options: {
//               text: text,
//               x: textX,
//               y: textY,
//               fontsize: 50,
//               fontcolor: "black",
//               fontfile: "fonts/FreeSerif.ttf",
//               boxcolor: "black@0.5", // Add a semi-transparent black background
//               boxborderw: 0, // No border
//               enable: `between(t,${textStart},${textDuration})`,
//             },
//           },
//         ])
//         .output(outputPath)
//         .on("end", async () => {
//           console.log("Step 2: Text overlay added");

//           // Upload the output video to S3
//           const fileBuffer = fs.readFileSync(outputPath);
//           const s3Key = `videos/${Date.now()}_output.mp4`;
//           try {
//             const url = await UploadFile(s3Key, {
//               buffer: fileBuffer,
//               mimetype: "video/mp4",
//             });
//             // Clean up local files
//             fs.unlinkSync(intermediatePath);
//             fs.unlinkSync(outputPath);
//             fs.unlinkSync(imagePath); // Clean up uploaded image
//             res.json({ url }); // Send the pre-signed URL to the frontend
//           } catch (err) {
//             console.error("Error uploading to S3:", err);
//             res.status(500).send("Error processing video");
//           }
//         })
//         .on("error", (err) => {
//           console.error("Error during text overlay processing:", err);
//           res.status(500).send("Error processing video");
//         });

//       command2.run();
//     })
//     .on("error", (err) => {
//       console.error("Error during image overlay processing:", err);
//       res.status(500).send("Error processing video");
//     });

//   command1.run();
// });
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
