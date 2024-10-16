var express = require("express");
var path = require("path");
var cors = require("cors");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const PORT = 3001;
const { sequelize, connectToDb } = require("./service/db");
const { cleanExpiredTokens } = require("./service/utils");
var cron = require('node-cron');

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var achievementsRouter = require("./routes/achievements");
var textsRouter = require("./routes/texts");
var themeRouter = require("./routes/themes");
var sentencesRouter = require("./routes/sentences");
var userSentenceSpecificationRouter = require("./routes/userSentenceSpecifications");
var utilsRouter = require("./routes/utils");
var skinsRouter = require("./routes/skins");
var testSpecificationsRouter = require("./routes/testSpecifications");
var plausibility = require("./routes/plausibility");
var errors = require("./routes/errors");
var criminals = require("./routes/criminals");
var games = require("./routes/games");
var messages = require("./routes/messages");
var comments = require("./routes/comments");
var stats = require("./routes/stats");
var variables = require("./routes/variables");

var app = express();
app.use(cors());

// // Si on veut restreindre l'accès:
// const corsOptions = {
//   origin: "http://localhost:3000", // Remplacez par l'URL de l'application client
// };
// app.use(cors(corsOptions));

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  await connectToDb();
});

// Nettoyage des tokens expirés une fois par jour à minuit 
cron.schedule('0 0 * * *', () => {
  cleanExpiredTokens();
});
// TODO Mettre l'appel du script month_end ici

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/achievements", achievementsRouter);
app.use("/texts", textsRouter);
app.use("/themes", themeRouter);
app.use("/sentences", sentencesRouter);
app.use("/userSentenceSpecifications", userSentenceSpecificationRouter);
app.use("/utils", utilsRouter);
app.use("/skins", skinsRouter);
app.use("/testSpecifications", testSpecificationsRouter);
app.use("/plausibility", plausibility);
app.use("/errors", errors);
app.use("/criminals", criminals);
app.use("/games", games);
app.use("/messages", messages);
app.use("/comments", comments);
app.use("/stats", stats);
app.use("/variables", variables);
module.exports = app;
