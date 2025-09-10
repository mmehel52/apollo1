const Agenda = require("agenda");
const { allDefinitions } = require("./definitions");
const Logger = require("../logger");

// establised a connection to our mongoDB database.
const agenda = new Agenda({
  db: {
    address: process.env.MONGODB_URI,
    collection: "agendaJobs",
    options: { useUnifiedTopology: true },
  },
  processEvery: "1 minute",
  priority: "high",
  maxConcurrency: 20,
});

// listen for the ready or error event.
agenda
  .on("ready", async () => {
    Logger.info("Agenda started!");
    await agenda.every("* * * * *", "scrabeApp", {});
  })
  .on("error", () => Logger.error("Agenda connection error!"));

agenda.on("start", (job) => {
  Logger.info(`Job ${job.attrs.name} starting`);
});

agenda.on("success", async (job) => {
  Logger.info(`Job ${job.attrs.name} successfully done`);
  // If the job was a failed job before, remove it from the database
  if (job.attrs.failedAt) {
    await job.remove();
  }
});

agenda.on("fail", async (err, job) => {
  Logger.error(`Job ${job.attrs.name} failed with error: ${err.message}`);
  // const nextRunAt = new Date();
  // job.attrs.nextRunAt = nextRunAt;
  // await job.save();
});

agenda.on("complete", (job) => {
  Logger.info(`Job ${job.attrs.name} completed`);
});

// define all agenda jobs
allDefinitions(agenda);

agenda.start();

module.exports = agenda;
