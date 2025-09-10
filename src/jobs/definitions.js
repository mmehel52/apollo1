const { JobHandlers } = require("./handlers");

const scrabeApp = (agenda) => {
  agenda.define("scrabeApp", JobHandlers.scrabeApp);
};

const definitions = [scrabeApp];

const allDefinitions = (agenda) => {
  definitions.forEach((definition) => definition(agenda));
};

module.exports = { allDefinitions };
