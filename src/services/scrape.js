const Logger = require("../logger");

class Scraper {
  constructor(browserManager, dataService) {
    this.browserManager = browserManager;
    this.dataService = dataService;
  }

  updatePageInUrl(url, pageNum) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("page", pageNum.toString());
      return urlObj.toString();
    } catch (error) {
      Logger.error("URL güncelleme hatası:", error);
      if (url.includes("page=")) {
        return url.replace(/page=\d+/, `page=${pageNum}`);
      } else {
        return `${url}${url.includes("?") ? "&" : "?"}page=${pageNum}`;
      }
    }
  }

  updateSortingInUrl(url) {
    try {
      const urlObj = new URL(url);
      const currentSortAscending = urlObj.searchParams.get("sortAscending");
      const newSortAscending =
        currentSortAscending === "true" ? "false" : "true";

      urlObj.searchParams.set("sortAscending", newSortAscending);
      urlObj.searchParams.set("page", "1");

      Logger.info(
        `Sorting changed: ${currentSortAscending} → ${newSortAscending}`
      );
      return urlObj.toString();
    } catch (error) {
      Logger.error("Sorting URL update error:", error);

      let newUrl = url;
      const currentSortMatch = newUrl.match(/sortAscending=([^&]*)/);
      const currentSortAscending = currentSortMatch
        ? currentSortMatch[1]
        : "true";
      const newSortAscending =
        currentSortAscending === "true" ? "false" : "true";

      if (newUrl.includes("sortAscending=")) {
        newUrl = newUrl.replace(
          /sortAscending=[^&]*/,
          `sortAscending=${newSortAscending}`
        );
      } else {
        newUrl += `${
          newUrl.includes("?") ? "&" : "?"
        }sortAscending=${newSortAscending}`;
      }

      if (newUrl.includes("page=")) {
        newUrl = newUrl.replace(/page=\d+/, "page=1");
      } else {
        newUrl += "&page=1";
      }

      Logger.info(
        `Sorting changed (fallback): ${currentSortAscending} → ${newSortAscending}`
      );
      return newUrl;
    }
  }

  updateTagInUrl(url, newTag) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete("qOrganizationKeywordTags[]");
      urlObj.searchParams.append("qOrganizationKeywordTags[]", newTag);
      urlObj.searchParams.set("page", "1");

      Logger.info(`Tag updated: "${newTag}"`);
      return urlObj.toString();
    } catch (error) {
      Logger.error("Tag URL update error:", error);

      let newUrl = url;
      newUrl = newUrl.replace(/&?qOrganizationKeywordTags\[\]=[^&]*/g, "");
      const separator = newUrl.includes("?") ? "&" : "?";
      newUrl += `${separator}qOrganizationKeywordTags[]=${encodeURIComponent(
        newTag
      )}`;

      if (newUrl.includes("page=")) {
        newUrl = newUrl.replace(/page=\d+/, "page=1");
      } else {
        newUrl += "&page=1";
      }

      Logger.info(`Tag updated (fallback): "${newTag}"`);
      return newUrl;
    }
  }

  async scrapeCompanies(maxPages = 5) {
    try {
      const keyTags = JSON.parse(process.env.KEYTAGS || "[]");
      Logger.info(`Found ${keyTags.length} tags to process`);

      if (keyTags.length === 0) {
        Logger.warning("No KEYTAGS found, using default scraping");
        await this.scrapeWithCurrentUrl(maxPages);
        return;
      }

      for (let tagIndex = 0; tagIndex < keyTags.length; tagIndex++) {
        const currentTag = keyTags[tagIndex];
        Logger.info(
          `🏷️ Processing tag ${tagIndex + 1}/${keyTags.length}: "${currentTag}"`
        );

        const baseUrl = this.browserManager.getPage().url();
        const tagUrl = this.updateTagInUrl(baseUrl, currentTag);

        await this.browserManager.getPage().goto(tagUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        await this.scrapeWithCurrentUrl(maxPages);

        if (tagIndex < keyTags.length - 1) {
          Logger.info("⏳ Waiting between tags...");
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }

      Logger.success(`🎉 All ${keyTags.length} tags processed successfully!`);
    } catch (error) {
      Logger.error("Data scraping error:", error);
      throw error;
    }
  }

  async scrapeWithCurrentUrl(maxPages) {
    try {
      const baseUrl = this.browserManager.getPage().url();

      Logger.info("🔄 First loop: Current sorting order");
      await this.scrapePagesLoop(baseUrl, maxPages);

      Logger.info("🔄 Second loop: Reversed sorting order");
      const reversedUrl = this.updateSortingInUrl(baseUrl);
      await this.scrapePagesLoop(reversedUrl, maxPages);

      Logger.success(`✅ Tag completed: ${maxPages * 2} pages processed`);
    } catch (error) {
      Logger.error("Tag scraping error:", error);
      throw error;
    }
  }

  async scrapePagesLoop(baseUrl, maxPages) {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      Logger.info(`📄 Page ${pageNum}/${maxPages} processing...`);

      if (pageNum > 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const pageUrl = this.updatePageInUrl(baseUrl, pageNum);
      Logger.info(`Navigating to: ${pageUrl}`);

      await this.browserManager.getPage().goto(pageUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pageCompanies = await this.extractCompaniesFromPage();

      if (pageCompanies.length === 0) {
        Logger.warning(`Page ${pageNum} companies not found`);
        continue;
      }

      this.dataService.addCompanies(pageCompanies);
      Logger.success(
        `Page ${pageNum}: ${pageCompanies.length} companies found`
      );
    }
  }

  async extractCompaniesFromPage() {
    try {
      Logger.info("🔍 Extracting companies from page...");

      // Sayfa yüklenmesini bekle
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Sayfa içeriğini kontrol et
      const pageContent = await this.browserManager.getPage().content();
      Logger.info(`📄 Page content: ${pageContent}`);

      // // Login kontrolü
      // if (pageContent.includes("login") || pageContent.includes("signin")) {
      //   Logger.warning("⚠️ Still on login page, login may have failed");
      //   return [];
      // }

      // Şirket verilerini çıkar
      const companies = await this.browserManager.getPage().evaluate(() => {
        const companyRows = [];

        // Farklı selector'ları dene
        const selectors = [
          '[role="row"]',
          ".zp_xvo3G",
          "tr",
          ".company-row",
          ".company-item",
        ];

        let rows = [];
        for (const selector of selectors) {
          rows = document.querySelectorAll(selector);
          if (rows.length > 0) {
            console.log(
              `Found ${rows.length} elements with selector: ${selector}`
            );
            break;
          }
        }

        if (rows.length === 0) {
          console.log("No company rows found");
          return [];
        }

        // Her satırı işle
        rows.forEach((row, index) => {
          try {
            // Şirket adını bul
            const nameSelectors = [
              'a[href*="organizations"] span',
              'a[href*="organizations"] .zp_xvo3G',
              ".zp_xvo3G",
              'a[href*="organizations"]',
              "h3",
              "h4",
              ".company-name",
            ];

            let companyName = "";
            for (const nameSelector of nameSelectors) {
              const nameElement = row.querySelector(nameSelector);
              if (nameElement && nameElement.textContent.trim()) {
                companyName = nameElement.textContent.trim();
                break;
              }
            }

            if (!companyName) {
              return; // Şirket adı bulunamadı
            }

            // Logo URL'sini bul
            const logoImg = row.querySelector(
              'img[alt*="logo"], img[alt*="company"]'
            );
            const logoUrl = logoImg ? logoImg.src : "";

            // Website URL'sini bul
            const websiteLink = row.querySelector(
              'a[href*="http"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])'
            );
            const websiteUrl = websiteLink ? websiteLink.href : "";

            // LinkedIn URL'sini bul
            const linkedinLink = row.querySelector('a[href*="linkedin.com"]');
            const linkedinUrl = linkedinLink ? linkedinLink.href : "";

            // Facebook URL'sini bul
            const facebookLink = row.querySelector('a[href*="facebook.com"]');
            const facebookUrl = facebookLink ? facebookLink.href : "";

            // Twitter URL'sini bul
            const twitterLink = row.querySelector(
              'a[href*="twitter.com"], a[href*="x.com"]'
            );
            const twitterUrl = twitterLink ? twitterLink.href : "";

            // Şirket boyutunu bul
            const sizeElement = row.querySelector(
              ".zp_Vnh4L, .company-size, .size, .employees"
            );
            const companySize = sizeElement
              ? sizeElement.textContent.trim()
              : "";

            // Konumu bul
            const locationElement = row.querySelector(
              ".zp_Vnh4L, .company-location, .location, .city, .country"
            );
            const companyLocation = locationElement
              ? locationElement.textContent.trim()
              : "";

            // Endüstriyi bul
            const industryElement = row.querySelector(
              ".zp_Vnh4L, .company-industry, .industry, .sector"
            );
            const companyIndustry = industryElement
              ? industryElement.textContent.trim()
              : "";

            companyRows.push({
              logo: logoUrl,
              isim: companyName,
              website: websiteUrl,
              linkedin: linkedinUrl,
              facebook: facebookUrl,
              twitter: twitterUrl,
              size: companySize,
              konum: companyLocation,
              endustri: companyIndustry,
              sayfa: "current",
              timestamp: new Date().toISOString(),
            });

            console.log(`Company found: ${companyName}`);
          } catch (error) {
            console.error(`Error processing row ${index}:`, error);
          }
        });

        return companyRows;
      });

      Logger.success(`✅ Found ${companies.length} companies`);
      return companies;
    } catch (error) {
      Logger.error("❌ Error extracting companies:", error);

      // Hata durumunda screenshot al
      try {
        await this.browserManager
          .getPage()
          .screenshot({ path: "error-page.png", fullPage: true });
        Logger.info("📸 Error screenshot saved: error-page.png");
      } catch (screenshotError) {
        Logger.error("Screenshot error:", screenshotError);
      }

      return [];
    }
  }
}

module.exports = Scraper;
