const { main } = require("../services/main");
const Logger = require("../logger");

const JobHandlers = {
  scrabeApp: async (job, done) => {
    Logger.info(`Scrapping app`);
    await main();

    done(null, `Scrapped app.`);
  },
};

module.exports = { JobHandlers };
