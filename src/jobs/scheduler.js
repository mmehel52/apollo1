const agenda = require("./index");

const schedule = {
  scrabeApp: async (data) => {
    await agenda.every("* * * * *", "scrabeApp", data);
  },
};

module.exports = { schedule };
