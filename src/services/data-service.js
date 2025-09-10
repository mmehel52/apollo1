const fs = require("fs");
const Logger = require("../logger");

class DataService {
  constructor() {
    this.companies = [];
  }

  addCompanies(companies) {
    this.companies.push(...companies);
  }

  getCompanies() {
    return this.companies;
  }

  clearCompanies() {
    this.companies = [];
  }

  async saveToJSON(filename = "apollo_companies.json") {
    try {
      if (this.companies.length === 0) {
        Logger.warning("No data to save");
        return;
      }

      const jsonContent = JSON.stringify(this.companies, null, 2);
      fs.writeFileSync(filename, jsonContent, "utf8");
      Logger.success(
        `${this.companies.length} company data saved to ${filename}`
      );
    } catch (error) {
      Logger.error("JSON save error:", error);
      throw error;
    }
  }

  async loadFromJSON(filename = "apollo_companies.json") {
    try {
      if (!fs.existsSync(filename)) {
        Logger.warning(`File ${filename} does not exist`);
        return [];
      }

      const jsonContent = fs.readFileSync(filename, "utf8");
      this.companies = JSON.parse(jsonContent);
      Logger.success(
        `${this.companies.length} company data loaded from ${filename}`
      );
      return this.companies;
    } catch (error) {
      Logger.error("JSON load error:", error);
      throw error;
    }
  }

  getStats() {
    return {
      totalCompanies: this.companies.length,
      companiesWithWebsite: this.companies.filter((c) => c.website).length,
      companiesWithLinkedIn: this.companies.filter((c) => c.linkedin).length,
      companiesWithFacebook: this.companies.filter((c) => c.facebook).length,
      companiesWithTwitter: this.companies.filter((c) => c.twitter).length,
      companiesWithLocation: this.companies.filter((c) => c.konum).length,
      companiesWithIndustry: this.companies.filter((c) => c.endustri).length,
    };
  }
}

module.exports = DataService;
