const { downloadFile } = require("../utils/comman");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const { exec } = require("child_process");

const { s3, UploadFile, Image_Link } = require("../utils/s3-config");

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

module.exports = {
  editVideo: async (req, res) => {
    const videoId = Math.floor(10000 + Math.random() * 90000);

    const imagePath = req.file.path;
    const videoUrl = req.body.videoUrl;

    const videoPath = `temp/${videoId}_video.mp4`;
    const videoPath2 = `temp/${videoId}_video2.mp4`;
    const outputPath = `output/${videoId}_output.mp4`;

    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Create a 2-second video from the image
    let command1 = ffmpeg()
      .input(imagePath)
      .loop(5)
      .outputOptions("-vf", "scale=690:362") // Set video resolution
      .output(videoPath)
      .on("end", async () => {
        try {
          let videoUrl2 = videoUrl;

          await downloadFile(videoUrl2, videoPath2);

          // Execute ffmpeg command
          exec(
            `ffmpeg -i ${videoPath} -i ${videoPath2} -filter_complex "[0:v]scale=690:362,setsar=1[v0];[1:v]scale=690:362,setsar=1[v1];[v0][v1]concat=n=2:v=1[outv]" -map "[outv]" ${outputPath}`,
            async (error, stdout, stderr) => {
              if (error) {
                console.error("Error merging videos:", error.message);
                res.status(500).send("Error merging videos");
                return;
              }

              console.log("Videos merged successfully");

              const fileBuffer = fs.readFileSync(outputPath);
              const s3Key = `videos/${videoId}_output.mp4`;
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
  },
  textImageOverlay: async (req, res) => {
    const videoPath = req.body.video; // Hardcoded video path
    const imagePath = req.file.path; // Image path from uploaded file
    const text = req.body.name; // Name from the request body
    console.log("Dr Name", text);
    // Hardcoded text and positions
    const textX = 400;
    const textY = 250;
    const textStart = 0;
    const textDuration = 2.5;

    // Hardcoded image positions and timings
    const imageX = 400;
    const imageY = 430;
    const imageStart = 0;
    const imageDuration = 2.5;

    const intermediatePath = `output/${videoId}_intermediate.mp4`;
    const outputPath = `output/${videoId}_output.mp4`;

    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Add image overlay
    let command1 = ffmpeg()
      .input(videoPath) // Specify video input
      .input(imagePath) // Specify image input
      .complexFilter([
        {
          filter: "overlay",
          options: {
            x: imageX,
            y: imageY,
            enable: `between(t,${imageStart},${imageDuration})`,
          },
        },
      ])
      .output(intermediatePath)
      .on("end", () => {
        console.log("Step 1: Image overlay added");

        // Step 2: Add text overlay to the intermediate video
        let command2 = ffmpeg()
          .input(intermediatePath) // Specify intermediate video input
          .complexFilter([
            {
              filter: "drawtext",
              options: {
                text: text,
                x: textX,
                y: textY,
                fontsize: 50,
                fontcolor: "black",
                fontfile: "fonts/FreeSerif.ttf",
                boxcolor: "black@0.5", // Add a semi-transparent black background
                boxborderw: 0, // No border
                enable: `between(t,${textStart},${textDuration})`,
              },
            },
          ])
          .output(outputPath)
          .on("end", async () => {
            console.log("Step 2: Text overlay added");

            // Upload the output video to S3
            const fileBuffer = fs.readFileSync(outputPath);
            const s3Key = `videos/${videoId}_output.mp4`;
            try {
              const url = await UploadFile(s3Key, {
                buffer: fileBuffer,
                mimetype: "video/mp4",
              });
              // Clean up local files
              fs.unlinkSync(intermediatePath);
              fs.unlinkSync(outputPath);
              fs.unlinkSync(imagePath); // Clean up uploaded image
              res.json({ url }); // Send the pre-signed URL to the frontend
            } catch (err) {
              console.error("Error uploading to S3:", err);
              res.status(500).send("Error processing video");
            }
          })
          .on("error", (err) => {
            console.error("Error during text overlay processing:", err);
            res.status(500).send("Error processing video");
          });

        command2.run();
      })
      .on("error", (err) => {
        console.error("Error during image overlay processing:", err);
        res.status(500).send("Error processing video");
      });

    command1.run();
  },
};
