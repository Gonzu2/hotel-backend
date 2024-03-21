const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const userActionsController = require("./routes/userActionsController");
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use("/api/v1", userActionsController);

const port = 4001;

const server = app.listen(port, () => {
  console.log(`Server successfully started on port ${port}`);
});
