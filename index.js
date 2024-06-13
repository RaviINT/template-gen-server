const express = require("express");
const path = require("path");
const cors = require("cors");

const videoRoute = require("./routes/video.routes");
const templateRoute = require("./routes/template.routes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);
app.use("/fonts", express.static(path.join(__dirname, "fonts")));
app.use("/", videoRoute);
app.use("/", templateRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
