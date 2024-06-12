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
const ffprobeStatic = require('ffprobe-static');

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path)

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
      let url = await Image_Link(`Image_Templates/card_background_${item}.`);
      arr.push(url);
    })
  );
  return res.status(200).send(arr);
});

app.post("/edit-video", upload.single("image"), async (req, res) => {
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

  const intermediatePath = `output/${Date.now()}_intermediate.mp4`;
  const outputPath = `output/${Date.now()}_output.mp4`;

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
          const s3Key = `videos/${Date.now()}_output.mp4`;
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
});

// 2 sec video done
app.post("/edit-video", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path; // Image path from uploaded file
  const text = req.body.name; // Name from the request body
  console.log("Dr Name", text);

  // Hardcoded text and positions
  const textX = 400;
  const textY = 250;
  const textStart = 0;
  const textDuration = 2.5;

  const videoPath = `output/${Date.now()}_video.mp4`;
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
    .outputOptions('-vf', 'scale=640:480') // Set video resolution
    .output(videoPath)
    .on('end', () => {
      console.log('Step 1: Video created from image');

      // Step 2: Add text overlay to the created video
      let command2 = ffmpeg()
        .input(videoPath)
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
        .on('end', async () => {
          console.log('Step 2: Text overlay added');

          // Upload the output video to S3
          const fileBuffer = fs.readFileSync(outputPath);
          const s3Key = `videos/${Date.now()}_output.mp4`;
          try {
            const url = await UploadFile(s3Key, {
              buffer: fileBuffer,
              mimetype: "video/mp4",
            });
            // Clean up local files
            fs.unlinkSync(videoPath);
            fs.unlinkSync(outputPath);
            fs.unlinkSync(imagePath); // Clean up uploaded image
            res.json({ url }); // Send the pre-signed URL to the frontend
          } catch (err) {
            console.error("Error uploading to S3:", err);
            res.status(500).send("Error processing video");
          }
        })
        .on('error', (err) => {
          console.error("Error during text overlay processing:", err);
          res.status(500).send("Error processing video");
        });

      command2.run();
    })
    .on('error', (err) => {
      console.error("Error during video creation from image:", err);
      res.status(500).send("Error processing video");
    });

  command1.run();
});




const downloadVideo = async (url, outputPath) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

app.post('/merge-videos', async (req, res) => {
  const { videoUrl1, videoUrl2 } = req.body;
  const mergedVideoPath = `output/${Date.now()}_mergedVideo.mp4`;

  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync('output')) {
      fs.mkdirSync('output');
    }
    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp');
    }

    // Download videos
    const videoPath1 = `temp/video1_${Date.now()}.mp4`;
    const videoPath2 = `temp/video2_${Date.now()}.mp4`;

    await downloadVideo(videoUrl1, videoPath1);
    await downloadVideo(videoUrl2, videoPath2);

    // Merge videos using FFmpeg
    ffmpeg()
      .input(videoPath1)
      .input(videoPath2)
      .complexFilter([
        '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]'
      ])
      .outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental'
      ])
      .on('start', commandLine => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error:', err);
        console.error('FFmpeg stderr:', stderr);
        res.status(500).send('Error merging videos');
      })
      .on('end', () => {
        console.log('Merging finished!');
        res.download(mergedVideoPath, (err) => {
          if (err) {
            console.error('Error sending merged video:', err);
            res.status(500).send('Error sending merged video');
          }

          // Cleanup temporary files
          fs.unlinkSync(videoPath1);
          fs.unlinkSync(videoPath2);
          fs.unlinkSync(mergedVideoPath);
        });
      })
      .save(mergedVideoPath);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send('Error processing request');
  }
});

const hasAudioStream = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
      resolve(hasAudio);
    });
  });
};

app.post('/merge-videos', async (req, res) => {
  const { videoUrl1, videoUrl2 } = req.body;
  const mergedVideoPath = `output/${Date.now()}_mergedVideo.mp4`;

  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync('output')) {
      fs.mkdirSync('output');
    }
    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp');
    }

    // Download videos
    const videoPath1 = `temp/video1_${Date.now()}.mp4`;
    const videoPath2 = `temp/video2_${Date.now()}.mp4`;

    await downloadVideo(videoUrl1, videoPath1);
    await downloadVideo(videoUrl2, videoPath2);

    // Check for audio streams
    const hasAudio1 = await hasAudioStream(videoPath1);
    const hasAudio2 = await hasAudioStream(videoPath2);

    // Build the filter graph
    const filterGraph = [
      `[0:v] [1:v] concat=n=2:v=1 [v]`
    ];
    if (hasAudio1 && hasAudio2) {
      filterGraph[0] = `[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]`;
    }

    // Merge videos using FFmpeg
    const command = ffmpeg()
      .input(videoPath1)
      .input(videoPath2)
      .complexFilter(filterGraph);

    // Add output options based on presence of audio
    if (hasAudio1 && hasAudio2) {
      command.outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental'
      ]);
    } else {
      command.outputOptions([
        '-map', '[v]',
        '-c:v', 'libx264'
      ]);
    }

    command
      .on('start', commandLine => {
        console.log('Spawned FFmpeg with command: ' + commandLine);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('Error:', err);
        console.error('FFmpeg stderr:', stderr);
        res.status(500).send('Error merging videos');
      })
      .on('end', () => {
        console.log('Merging finished!');
        res.download(mergedVideoPath, (err) => {
          if (err) {
            console.error('Error sending merged video:', err);
            res.status(500).send('Error sending merged video');
          }

          // Cleanup temporary files
          fs.unlinkSync(videoPath1);
          fs.unlinkSync(videoPath2);
          fs.unlinkSync(mergedVideoPath);
        });
      })
      .save(mergedVideoPath);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send('Error processing request');
  }
});




const hasAudioStream = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      const hasAudio = metadata.streams.some((stream) => stream.codec_type === "audio");
      resolve(hasAudio);
    });
  });
};

const downloadVideo = async (url, outputPath) => {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};
app.post("/edit-video", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;

  const videoPath = `output/${Date.now()}_video.mp4`;
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
      // const { videoUrl1, videoUrl2 } = req.body;
      // let videoUrl1 =
      //   "https://video-editor-poc-int.s3.ap-south-1.amazonaws.com/videos/1718096979460_output.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIATPQ4QJYNYR76XNJX%2F20240611%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20240611T090939Z&X-Amz-Expires=500000&X-Amz-Signature=7fd36cde6fd54d7e20b15ab49b9c53c278b2cbb57ea04ba886cc73739a1c2131&X-Amz-SignedHeaders=host&x-id=GetObject";
      let videoUrl2 =
        "https://www.shutterstock.com/shutterstock/videos/3415672027/preview/stock-footage-analog-manual-second-countdown-white-background.webm";
      const mergedVideoPath = `output/${Date.now()}_mergedVideo.mp4`;

      try {
        // Create output directory if it doesn't exist
        if (!fs.existsSync("output")) {
          fs.mkdirSync("output");
        }
        if (!fs.existsSync("temp")) {
          fs.mkdirSync("temp");
        }

        // Download videos
        const videoPath1 = videoPath;
        const videoPath2 = `temp/video2_${Date.now()}.mp4`;

        // await downloadVideo(videoUrl1, videoPath1);
        await downloadVideo(videoUrl2, videoPath2);

        // Check for audio streams
        const hasAudio1 = await hasAudioStream(videoPath1);
        const hasAudio2 = await hasAudioStream(videoPath2);

        // Build the filter graph
        const filterGraph = [`[0:v] [1:v] concat=n=2:v=1 [v]`];
        if (hasAudio1 && hasAudio2) {
          filterGraph[0] = `[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]`;
        }

        // Merge videos using FFmpeg
        const command = ffmpeg().input(videoPath1).input(videoPath2).complexFilter(filterGraph);

        // Add output options based on presence of audio
        if (hasAudio1 && hasAudio2) {
          command.outputOptions(["-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", "-strict", "experimental"]);
        } else {
          command.outputOptions(["-map", "[v]", "-c:v", "libx264"]);
        }

        command
          .on("start", (commandLine) => {
            // console.log("Spawned FFmpeg with command: " + commandLine);
          })
          .on("error", (err, stdout, stderr) => {
            console.error("Error:", err);
            // console.error("FFmpeg stderr:", stderr);
            res.status(500).send("Error merging videos");
          })
          .on("end", async () => {
            console.log("Merging finished!");
            const fileBuffer = fs.readFileSync(mergedVideoPath);
            const s3Key = `videos/${Date.now()}_output.mp4`;
            try {
              const url = await UploadFile(s3Key, {
                buffer: fileBuffer,
                mimetype: "video/mp4",
              });
              // Clean up local files
              fs.unlinkSync(videoPath1);
              fs.unlinkSync(videoPath2);
              fs.unlinkSync(videoPath);
              fs.unlinkSync(mergedVideoPath); // Clean up uploaded image
              res.json({ url }); // Send the pre-signed URL to the frontend
            } catch (err) {
              console.error("Error uploading to S3:", err);
              res.status(500).send("Error processing video");
            }
          })
          .save(mergedVideoPath);
      } catch (error) {
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
