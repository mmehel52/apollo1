const Agenda = require("agenda");
const Logger = require("./logger");
const { main } = require("./main");

class CronJobService {
  constructor() {
    this.agenda = new Agenda({
      db: {
        address: process.env.MONGODB_URI,
        collection: "agendaJobs",
      },
      processEvery: "30 seconds",
    });

    this.setupJobs();
  }

  setupJobs() {
    this.agenda.define("scrape-apollo", async (job) => {
      Logger.info("🕐 Cron job started: Apollo.io scraping...");

      try {
        await main();
        Logger.success("✅ Cron job completed");
      } catch (error) {
        Logger.error("❌ Cron job error:", error);
        throw error;
      }
    });

    // Job completed log
    this.agenda.on("complete:scrape-apollo", (job) => {
      Logger.info(`✅ Job ${job.attrs.name} completed`);
    });

    // Job failed log
    this.agenda.on("fail:scrape-apollo", (err, job) => {
      Logger.error(`❌ Job ${job.attrs.name} failed:`, err);
    });
  }

  async start() {
    try {
      await this.agenda.start();
      Logger.success("🚀 Cron job service started");

      await this.agenda.every("18 * * * *", "scrape-apollo");
      Logger.info("⏰ Apollo scraping job every 10 minutes");
    } catch (error) {
      Logger.error("Cron job service failed to start:", error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.agenda.stop();
      Logger.info("🛑 Cron job service stopped");
    } catch (error) {
      Logger.error("Cron job service failed to stop:", error);
    }
  }

  // Run job manually
  async runJobNow() {
    try {
      await this.agenda.now("scrape-apollo");
      Logger.info("🔄 Job run manually");
    } catch (error) {
      Logger.error("Manuel job failed to run:", error);
    }
  }

  // List all jobs
  async getJobs() {
    try {
      const jobs = await this.agenda.jobs();
      return jobs.map((job) => ({
        name: job.attrs.name,
        nextRunAt: job.attrs.nextRunAt,
        lastRunAt: job.attrs.lastRunAt,
        repeatInterval: job.attrs.repeatInterval,
      }));
    } catch (error) {
      Logger.error("Job list failed to get:", error);
      return [];
    }
  }
}

module.exports = CronJobService;
