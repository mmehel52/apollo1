const Logger = require("../logger");

class Scraper {
  constructor(browserManager, dataService) {
    this.browserManager = browserManager;
    this.dataService = dataService;
  }

  updatePageInUrl(url, pageNum) {
    try {
      const urlObj = new URL(url);

      // page parametresini güncelle
      urlObj.searchParams.set("page", pageNum.toString());

      return urlObj.toString();
    } catch (error) {
      Logger.error("URL güncelleme hatası:", error);

      // Fallback: regex ile page parametresini değiştir
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
      await this.scrapePagesLoop(baseUrl, maxPages);
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
      if (pageNum > 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const pageUrl = this.updatePageInUrl(baseUrl, pageNum);

      await this.browserManager.getPage().goto(pageUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const pageCompanies = await this.extractCompaniesFromPage();

      if (pageCompanies.length === 0) {
        Logger.warning(` Page ${pageNum} companies not found`);
        continue;
      }

      this.dataService.addCompanies(pageCompanies);
      Logger.success(
        ` Page ${pageNum}: ${pageCompanies.length} companies found`
      );
    }
  }

  async extractCompaniesFromPage() {
    try {
      Logger.info("Analyzing page structure...");

      Logger.info("Waiting for page to load...");
      await new Promise((resolve) => setTimeout(resolve, 15000));

      try {
        await this.browserManager
          .getPage()
          .waitForSelector(".zp_xvo3G", { timeout: 30000 });
        Logger.success("Company names loaded");
      } catch (error) {
        Logger.warning("Timeout waiting for company names, continuing...");
      }

      Logger.info("Additional waiting time...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check page HTML
      const pageContent = await this.browserManager.getPage().content();
      Logger.info(`Page content length: ${pageContent.length} characters`);

      // Try different selectors
      const possibleSelectors = [
        '[role="row"]',
        ".company-row",
        ".company-item",
        '[data-testid="company-row"]',
        ".zp_xvo3G",
        "tr",
        ".company-card",
        ".zp_company_row",
        ".zp_company_item",
        '[data-testid="company"]',
        ".company-list-item",
        ".zp_list_item",
        ".zp_table_row",
      ];

      let foundSelector = null;
      for (const selector of possibleSelectors) {
        const elements = await this.browserManager.getPage().$$(selector);
        if (elements.length > 0) {
          Logger.success(
            `Selector found: ${selector} (${elements.length} elements)`
          );
          foundSelector = selector;
          break;
        }
      }

      if (!foundSelector) {
        Logger.warning(
          "No company rows found. Page structure may have changed."
        );

        // Check page URL
        const currentUrl = this.browserManager.getPage().url();
        Logger.info(`Current URL: ${currentUrl}`);

        // Check page title
        const pageTitle = await this.browserManager.getPage().title();
        Logger.info(`Page title: ${pageTitle}`);

        // Take page screenshot
        await this.browserManager
          .getPage()
          .screenshot({ path: "debug-page.png", fullPage: true });
        Logger.info("Debug screenshot saved: debug-page.png");

        // Extract some information from HTML content
        const pageContent = await this.browserManager.getPage().content();
        if (pageContent.includes("login") || pageContent.includes("signin")) {
          Logger.warning(
            "Page still appears to be on login page. Login may have failed."
          );
        }

        return [];
      }

      const companies = await this.browserManager.getPage().evaluate(
        (selector, logger) => {
          const companyRows = [];
          const rows = document.querySelectorAll(selector);

          logger.info(`Found ${rows.length} rows, analyzing...`);

          // Alternative method: Scan the entire page to find company data
          const alternativeMethod = () => {
            logger.info("Trying alternative method...");

            // Find all company links
            const companyLinks = document.querySelectorAll(
              'a[href*="organizations"]'
            );
            logger.info(`Found ${companyLinks.length} company links`);

            companyLinks.forEach((link, index) => {
              try {
                const companyName = link.textContent.trim();
                if (companyName && companyName.length > 0) {
                  logger.info(
                    `Company found with alternative method: "${companyName}"`
                  );

                  // Find nearest row
                  let row =
                    link.closest('[role="row"]') ||
                    link.closest("tr") ||
                    link.parentElement;

                  // Find logo
                  const logoImg = row
                    ? row.querySelector('img[alt*="logo"], img[alt*="company"]')
                    : null;
                  const logoUrl = logoImg ? logoImg.src : "";

                  // Find employee count
                  const sizeSelectors = [
                    '.zp_Vnh4L[data-count-size="large"]',
                    '.zp_Vnh4L[data-count-size="medium"]',
                    '.zp_Vnh4L[data-count-size="small"]',
                    ".zp_Vnh4L",
                    ".company-size",
                    ".size",
                    ".employees",
                    ".employee-count",
                    ".staff-size",
                  ];
                  let sizeElement = null;
                  if (row) {
                    for (const sizeSelector of sizeSelectors) {
                      sizeElement = row.querySelector(sizeSelector);
                      if (sizeElement && sizeElement.textContent.trim()) break;
                    }
                  }
                  const companySize = sizeElement
                    ? sizeElement.textContent.trim()
                    : "";

                  // Find location
                  const locationSelectors = [
                    '.zp_Vnh4L[data-count-location="large"]',
                    '.zp_Vnh4L[data-count-location="medium"]',
                    '.zp_Vnh4L[data-count-location="small"]',
                    ".zp_Vnh4L",
                    ".zp_FEm_X .zp_FEm_X",
                    ".zp_FEm_X button",
                    ".zp_FEm_X span",
                    ".zp_FEm_X div",
                    ".company-location",
                    '[data-testid="company-location"]',
                    '[data-testid="location"]',
                    ".location",
                    ".city",
                    ".country",
                    ".address",
                    ".region",
                    ".state",
                    ".headquarters",
                    ".office-location",
                    ".zp_location",
                    ".zp_company_location",
                    ".zp_city",
                    ".zp_country",
                    ".zp_address",
                    "span[title*='location']",
                    "div[title*='location']",
                    "span[title*='city']",
                    "div[title*='city']",
                    "span[title*='country']",
                    "div[title*='country']",
                  ];
                  let locationElement = null;
                  if (row) {
                    for (const locationSelector of locationSelectors) {
                      locationElement = row.querySelector(locationSelector);
                      if (
                        locationElement &&
                        locationElement.textContent.trim() &&
                        locationElement.textContent.trim().length > 0 &&
                        locationElement.textContent.trim().length < 100
                      ) {
                        break;
                      }
                    }
                  }
                  const companyLocation = locationElement
                    ? locationElement.textContent.trim()
                    : "";

                  // Find industry
                  const industrySelectors = [
                    '.zp_Vnh4L[data-count-industry="large"]',
                    '.zp_Vnh4L[data-count-industry="medium"]',
                    '.zp_Vnh4L[data-count-industry="small"]',
                    ".zp_Vnh4L",
                    ".company-industry",
                    '[data-testid="company-industry"]',
                    '[data-testid="industry"]',
                    ".industry",
                    ".sector",
                    ".category",
                    ".business-type",
                    ".company-type",
                    ".vertical",
                    ".business-category",
                    ".market-segment",
                    ".zp_industry",
                    ".zp_company_industry",
                    ".zp_sector",
                    ".zp_category",
                    ".zp_business_type",
                    ".zp_vertical",
                    "span[title*='industry']",
                    "div[title*='industry']",
                    "span[title*='sector']",
                    "div[title*='sector']",
                    "span[title*='category']",
                    "div[title*='category']",
                  ];
                  let industryElement = null;
                  if (row) {
                    for (const industrySelector of industrySelectors) {
                      industryElement = row.querySelector(industrySelector);
                      if (
                        industryElement &&
                        industryElement.textContent.trim() &&
                        industryElement.textContent.trim().length > 0 &&
                        industryElement.textContent.trim().length < 100
                      ) {
                        break;
                      }
                    }
                  }
                  const companyIndustry = industryElement
                    ? industryElement.textContent.trim()
                    : "";

                  // Find website, LinkedIn, Facebook, Twitter links
                  let websiteUrl = "";
                  let linkedinUrl = "";
                  let facebookUrl = "";
                  let twitterUrl = "";

                  if (row) {
                    // Find website
                    const websiteSelectors = [
                      'a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"]):not([href*="apollo.io"]):not([href*="zenprospect"])',
                      'a[href*="www."]',
                      'a[data-href*="http"]:not([data-href*="linkedin"]):not([data-href*="facebook"]):not([data-href*="twitter"])',
                      'a[data-href*="www."]',
                      ".website a",
                      '[data-testid="website"]',
                      ".company-website a",
                      ".website-link a",
                      '.zp_ycoAs a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      '.zp_FEm_X a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      ".zp_website a",
                      ".zp_company_website a",
                      'a[href^="http"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      'a[href^="https"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                    ];
                    let websiteLink = null;
                    for (const websiteSelector of websiteSelectors) {
                      websiteLink = row.querySelector(websiteSelector);
                      if (
                        websiteLink &&
                        websiteLink.href &&
                        !websiteLink.href.includes("apollo.io") &&
                        !websiteLink.href.includes("zenprospect") &&
                        !websiteLink.href.includes("linkedin.com") &&
                        !websiteLink.href.includes("facebook.com") &&
                        !websiteLink.href.includes("twitter.com") &&
                        !websiteLink.href.includes("x.com")
                      ) {
                        break;
                      }
                    }
                    websiteUrl = websiteLink ? websiteLink.href : "";

                    // Find LinkedIn
                    const linkedinSelectors = [
                      'a[href*="linkedin.com"]',
                      'a[href*="linkedin.com/company"]',
                      'a[data-href*="linkedin.com"]',
                      '.zp_ycoAs a[href*="linkedin.com"]',
                      '.zp_FEm_X a[href*="linkedin.com"]',
                      ".zp_linkedin a",
                      ".zp_company_linkedin a",
                      ".linkedin a",
                      ".social-linkedin a",
                      '[data-testid="linkedin"] a',
                    ];
                    let linkedinLink = null;
                    for (const linkedinSelector of linkedinSelectors) {
                      linkedinLink = row.querySelector(linkedinSelector);
                      if (linkedinLink && linkedinLink.href) break;
                    }
                    linkedinUrl = linkedinLink ? linkedinLink.href : "";

                    // Find Facebook
                    const facebookSelectors = [
                      'a[href*="facebook.com"]',
                      'a[href*="fb.com"]',
                      'a[data-href*="facebook.com"]',
                      'a[data-href*="fb.com"]',
                      '.zp_ycoAs a[href*="facebook.com"]',
                      '.zp_FEm_X a[href*="facebook.com"]',
                      ".zp_facebook a",
                      ".zp_company_facebook a",
                      ".facebook a",
                      ".social-facebook a",
                      '[data-testid="facebook"] a',
                    ];
                    let facebookLink = null;
                    for (const facebookSelector of facebookSelectors) {
                      facebookLink = row.querySelector(facebookSelector);
                      if (facebookLink && facebookLink.href) break;
                    }
                    facebookUrl = facebookLink ? facebookLink.href : "";

                    // Find Twitter
                    const twitterSelectors = [
                      'a[href*="twitter.com"]',
                      'a[href*="x.com"]',
                      'a[data-href*="twitter.com"]',
                      'a[data-href*="x.com"]',
                      '.zp_ycoAs a[href*="twitter.com"]',
                      '.zp_FEm_X a[href*="twitter.com"]',
                      ".zp_twitter a",
                      ".zp_company_twitter a",
                      ".twitter a",
                      ".social-twitter a",
                      '[data-testid="twitter"] a',
                    ];
                    let twitterLink = null;
                    for (const twitterSelector of twitterSelectors) {
                      twitterLink = row.querySelector(twitterSelector);
                      if (twitterLink && twitterLink.href) break;
                    }
                    twitterUrl = twitterLink ? twitterLink.href : "";
                  }

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
                    method: "alternative",
                  });
                }
              } catch (error) {
                logger.error(`Alternative method row ${index} error:`, error);
              }
            });
          };

          rows.forEach((row, index) => {
            // Debug: Check each row's HTML content
            logger.warning(
              `Row ${index} HTML:`,
              row.outerHTML.substring(0, 300) + "..."
            );

            // Test all possible selectors for company name
            logger.warning(`Testing selectors for row ${index}...`);

            try {
              // Find company name - Apollo.io's real structure
              const nameSelectors = [
                ".zp_xvo3G.zp_yepte",
                "a[data-to*='organizations'] .zp_xvo3G",
                "a[data-to*='organizations'] span",
                ".zp_company_name",
                ".zp_org_name",
                "[data-testid='organization-name']",
                ".organization-name",
                ".zp_text",
                ".zp_company_title",
                ".zp_company_link",
                ".company-name",
                "[data-testid='company-name']",
                "h3",
                "h4",
                ".title",
                "a[href*='company']",
                // New selectors
                ".zp_oS4ck a span",
                ".zp_oS4ck span",
                ".zp_oS4ck .zp_xvo3G",
                "a[href*='organizations'] span",
                "a[href*='organizations'] .zp_xvo3G",
                // More specific selectors
                "a[href*='organizations'] .zp_xvo3G.zp_yepte",
                ".zp_oS4ck a .zp_xvo3G",
                ".zp_oS4ck a .zp_xvo3G.zp_yepte",
                "a[data-to*='organizations'] .zp_xvo3G.zp_yepte",
                ".zp_oS4ck a[data-to*='organizations'] .zp_xvo3G",
              ];

              let nameElement = null;
              for (const nameSelector of nameSelectors) {
                nameElement = row.querySelector(nameSelector);
                if (nameElement && nameElement.textContent.trim()) {
                  logger.warning(
                    `Company name found: "${nameElement.textContent.trim()}" (selector: ${nameSelector})`
                  );
                  break;
                }
              }

              if (!nameElement || !nameElement.textContent.trim()) {
                logger.warning(`Row ${index}: Company name not found`);
                logger.warning(`selectors that tried`, nameSelectors);

                // Alternative method: Check all text content
                const allText = row.textContent.trim();
                if (allText.length > 0) {
                  logger.warning(
                    `Row ${index} text content:`,
                    allText.substring(0, 100) + "..."
                  );
                }

                return;
              }

              const companyName = nameElement.textContent.trim();

              // Find logo - Apollo.io's real structure
              const logoSelectors = [
                'img[alt="Company logo"]',
                ".zp_oS4ck img",
                ".zp_qoPec img",
                'img[alt*="logo"]',
                'img[alt*="company"]',
                ".company-logo img",
                ".logo img",
              ];
              let logoImg = null;
              for (const logoSelector of logoSelectors) {
                logoImg = row.querySelector(logoSelector);
                if (logoImg) break;
              }
              const logoUrl = logoImg ? logoImg.src : "";

              // Find website link - Extended selectors
              const websiteSelectors = [
                // Apollo.io spesifik selector'lar
                'a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"]):not([href*="apollo.io"]):not([href*="zenprospect"])',
                'a[href*="www."]',
                'a[data-href*="http"]:not([data-href*="linkedin"]):not([data-href*="facebook"]):not([data-href*="twitter"])',
                'a[data-href*="www."]',
                // General selectors
                ".website a",
                '[data-testid="website"]',
                ".company-website a",
                ".website-link a",
                // Apollo.io CSS classes
                '.zp_ycoAs a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                '.zp_FEm_X a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                ".zp_website a",
                ".zp_company_website a",
                // More specific selectors
                'a[href^="http"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                'a[href^="https"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
              ];
              let websiteLink = null;
              for (const websiteSelector of websiteSelectors) {
                websiteLink = row.querySelector(websiteSelector);
                if (
                  websiteLink &&
                  websiteLink.href &&
                  !websiteLink.href.includes("apollo.io") &&
                  !websiteLink.href.includes("zenprospect") &&
                  !websiteLink.href.includes("linkedin.com") &&
                  !websiteLink.href.includes("facebook.com") &&
                  !websiteLink.href.includes("twitter.com") &&
                  !websiteLink.href.includes("x.com")
                ) {
                  break;
                }
              }
              const websiteUrl = websiteLink ? websiteLink.href : "";

              // Find LinkedIn link - Extended selectors
              const linkedinSelectors = [
                'a[href*="linkedin.com"]',
                'a[href*="linkedin.com/company"]',
                'a[data-href*="linkedin.com"]',
                // Apollo.io specific
                '.zp_ycoAs a[href*="linkedin.com"]',
                '.zp_FEm_X a[href*="linkedin.com"]',
                ".zp_linkedin a",
                ".zp_company_linkedin a",
                // General selectors
                ".linkedin a",
                ".social-linkedin a",
                '[data-testid="linkedin"] a',
              ];
              let linkedinLink = null;
              for (const linkedinSelector of linkedinSelectors) {
                linkedinLink = row.querySelector(linkedinSelector);
                if (linkedinLink && linkedinLink.href) break;
              }
              const linkedinUrl = linkedinLink ? linkedinLink.href : "";

              // Find Facebook link - Extended selectors
              const facebookSelectors = [
                'a[href*="facebook.com"]',
                'a[href*="fb.com"]',
                'a[data-href*="facebook.com"]',
                'a[data-href*="fb.com"]',
                // Apollo.io specific
                '.zp_ycoAs a[href*="facebook.com"]',
                '.zp_FEm_X a[href*="facebook.com"]',
                ".zp_facebook a",
                ".zp_company_facebook a",
                // General selectors
                ".facebook a",
                ".social-facebook a",
                '[data-testid="facebook"] a',
              ];
              let facebookLink = null;
              for (const facebookSelector of facebookSelectors) {
                facebookLink = row.querySelector(facebookSelector);
                if (facebookLink && facebookLink.href) break;
              }
              const facebookUrl = facebookLink ? facebookLink.href : "";

              // Find Twitter link - Extended selectors
              const twitterSelectors = [
                'a[href*="twitter.com"]',
                'a[href*="x.com"]',
                'a[data-href*="twitter.com"]',
                'a[data-href*="x.com"]',
                // Apollo.io specific
                '.zp_ycoAs a[href*="twitter.com"]',
                '.zp_FEm_X a[href*="twitter.com"]',
                ".zp_twitter a",
                ".zp_company_twitter a",
                // General selectors
                ".twitter a",
                ".social-twitter a",
                '[data-testid="twitter"] a',
              ];
              let twitterLink = null;
              for (const twitterSelector of twitterSelectors) {
                twitterLink = row.querySelector(twitterSelector);
                if (twitterLink && twitterLink.href) break;
              }
              const twitterUrl = twitterLink ? twitterLink.href : "";

              // Find company size - Apollo.io's real structure
              const sizeSelectors = [
                '.zp_Vnh4L[data-count-size="large"]',
                '.zp_Vnh4L[data-count-size="medium"]',
                '.zp_Vnh4L[data-count-size="small"]',
                ".zp_Vnh4L",
                ".company-size",
                '[data-testid="company-size"]',
                ".size",
                ".employees",
              ];
              let sizeElement = null;
              for (const sizeSelector of sizeSelectors) {
                sizeElement = row.querySelector(sizeSelector);
                if (sizeElement && sizeElement.textContent.trim()) break;
              }
              const companySize = sizeElement
                ? sizeElement.textContent.trim()
                : "";

              // Find company location - Extended selectors
              const locationSelectors = [
                // Apollo.io specific selectors
                '.zp_Vnh4L[data-count-location="large"]',
                '.zp_Vnh4L[data-count-location="medium"]',
                '.zp_Vnh4L[data-count-location="small"]',
                ".zp_Vnh4L",
                ".zp_FEm_X .zp_FEm_X",
                ".zp_FEm_X button",
                ".zp_FEm_X span",
                ".zp_FEm_X div",
                // General selectors
                ".company-location",
                '[data-testid="company-location"]',
                '[data-testid="location"]',
                ".location",
                ".city",
                ".country",
                ".address",
                ".region",
                ".state",
                ".headquarters",
                ".office-location",
                // Apollo.io CSS classes
                ".zp_location",
                ".zp_company_location",
                ".zp_city",
                ".zp_country",
                ".zp_address",
                // More specific selectors
                "span[title*='location']",
                "div[title*='location']",
                "span[title*='city']",
                "div[title*='city']",
                "span[title*='country']",
                "div[title*='country']",
              ];
              let locationElement = null;
              for (const locationSelector of locationSelectors) {
                locationElement = row.querySelector(locationSelector);
                if (
                  locationElement &&
                  locationElement.textContent.trim() &&
                  locationElement.textContent.trim().length > 0 &&
                  locationElement.textContent.trim().length < 100
                ) {
                  // Filter out too long text
                  break;
                }
              }
              const companyLocation = locationElement
                ? locationElement.textContent.trim()
                : "";

              // Find industry information - Extended selectors
              const industrySelectors = [
                // Apollo.io specific selectors
                '.zp_Vnh4L[data-count-industry="large"]',
                '.zp_Vnh4L[data-count-industry="medium"]',
                '.zp_Vnh4L[data-count-industry="small"]',
                ".zp_Vnh4L",
                // General selectors
                ".company-industry",
                '[data-testid="company-industry"]',
                '[data-testid="industry"]',
                ".industry",
                ".sector",
                ".category",
                ".business-type",
                ".company-type",
                ".vertical",
                ".business-category",
                ".market-segment",
                // Apollo.io CSS classes
                ".zp_industry",
                ".zp_company_industry",
                ".zp_sector",
                ".zp_category",
                ".zp_business_type",
                ".zp_vertical",
                // More specific selectors
                "span[title*='industry']",
                "div[title*='industry']",
                "span[title*='sector']",
                "div[title*='sector']",
                "span[title*='category']",
                "div[title*='category']",
              ];
              let industryElement = null;
              for (const industrySelector of industrySelectors) {
                industryElement = row.querySelector(industrySelector);
                if (
                  industryElement &&
                  industryElement.textContent.trim() &&
                  industryElement.textContent.trim().length > 0 &&
                  industryElement.textContent.trim().length < 100
                ) {
                  // Filter out too long text
                  break;
                }
              }
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

              logger.info(
                `Company found: ${companyName} (${companySize} employees, ${companyLocation})`
              );
            } catch (error) {
              logger.error(`Error processing row ${index}:`, error);
            }
          });

          // If normal method failed, try alternative method
          if (companyRows.length === 0) {
            logger.warning(
              "Normal method failed, trying alternative method..."
            );
            alternativeMethod();
          }

          // If still no company found, scan all pages to find
          if (companyRows.length === 0) {
            logger.warning("🔄 Scanning all pages...");

            // Find all company links
            const allCompanyLinks = document.querySelectorAll(
              'a[href*="organizations"], a[data-to*="organizations"]'
            );
            logger.warning(
              `🔗 Total ${allCompanyLinks.length} company links found`
            );

            allCompanyLinks.forEach((link, index) => {
              try {
                const companyName = link.textContent.trim();
                if (
                  companyName &&
                  companyName.length > 0 &&
                  companyName.length < 100
                ) {
                  // Filter out too long text
                  logger.warning(
                    `✅ all pages scanned and company found: "${companyName}"`
                  );

                  // Find nearest row
                  let row =
                    link.closest('[role="row"]') ||
                    link.closest("tr") ||
                    link.parentElement;

                  // Find logo
                  const logoImg = row
                    ? row.querySelector('img[alt*="logo"], img[alt*="company"]')
                    : null;
                  const logoUrl = logoImg ? logoImg.src : "";

                  // Find employee count
                  const sizeSelectors = [
                    '.zp_Vnh4L[data-count-size="large"]',
                    '.zp_Vnh4L[data-count-size="medium"]',
                    '.zp_Vnh4L[data-count-size="small"]',
                    ".zp_Vnh4L",
                    ".company-size",
                    ".size",
                    ".employees",
                    ".employee-count",
                    ".staff-size",
                  ];
                  let sizeElement = null;
                  if (row) {
                    for (const sizeSelector of sizeSelectors) {
                      sizeElement = row.querySelector(sizeSelector);
                      if (sizeElement && sizeElement.textContent.trim()) break;
                    }
                  }
                  const companySize = sizeElement
                    ? sizeElement.textContent.trim()
                    : "";

                  // Find location
                  const locationSelectors = [
                    '.zp_Vnh4L[data-count-location="large"]',
                    '.zp_Vnh4L[data-count-location="medium"]',
                    '.zp_Vnh4L[data-count-location="small"]',
                    ".zp_Vnh4L",
                    ".zp_FEm_X .zp_FEm_X",
                    ".zp_FEm_X button",
                    ".zp_FEm_X span",
                    ".zp_FEm_X div",
                    ".company-location",
                    '[data-testid="company-location"]',
                    '[data-testid="location"]',
                    ".location",
                    ".city",
                    ".country",
                    ".address",
                    ".region",
                    ".state",
                    ".headquarters",
                    ".office-location",
                    ".zp_location",
                    ".zp_company_location",
                    ".zp_city",
                    ".zp_country",
                    ".zp_address",
                    "span[title*='location']",
                    "div[title*='location']",
                    "span[title*='city']",
                    "div[title*='city']",
                    "span[title*='country']",
                    "div[title*='country']",
                  ];
                  let locationElement = null;
                  if (row) {
                    for (const locationSelector of locationSelectors) {
                      locationElement = row.querySelector(locationSelector);
                      if (
                        locationElement &&
                        locationElement.textContent.trim() &&
                        locationElement.textContent.trim().length > 0 &&
                        locationElement.textContent.trim().length < 100
                      ) {
                        break;
                      }
                    }
                  }
                  const companyLocation = locationElement
                    ? locationElement.textContent.trim()
                    : "";

                  // Find industry
                  const industrySelectors = [
                    '.zp_Vnh4L[data-count-industry="large"]',
                    '.zp_Vnh4L[data-count-industry="medium"]',
                    '.zp_Vnh4L[data-count-industry="small"]',
                    ".zp_Vnh4L",
                    ".company-industry",
                    '[data-testid="company-industry"]',
                    '[data-testid="industry"]',
                    ".industry",
                    ".sector",
                    ".category",
                    ".business-type",
                    ".company-type",
                    ".vertical",
                    ".business-category",
                    ".market-segment",
                    ".zp_industry",
                    ".zp_company_industry",
                    ".zp_sector",
                    ".zp_category",
                    ".zp_business_type",
                    ".zp_vertical",
                    "span[title*='industry']",
                    "div[title*='industry']",
                    "span[title*='sector']",
                    "div[title*='sector']",
                    "span[title*='category']",
                    "div[title*='category']",
                  ];
                  let industryElement = null;
                  if (row) {
                    for (const industrySelector of industrySelectors) {
                      industryElement = row.querySelector(industrySelector);
                      if (
                        industryElement &&
                        industryElement.textContent.trim() &&
                        industryElement.textContent.trim().length > 0 &&
                        industryElement.textContent.trim().length < 100
                      ) {
                        break;
                      }
                    }
                  }
                  const companyIndustry = industryElement
                    ? industryElement.textContent.trim()
                    : "";

                  // Find website, LinkedIn, Facebook, Twitter links
                  let websiteUrl = "";
                  let linkedinUrl = "";
                  let facebookUrl = "";
                  let twitterUrl = "";

                  if (row) {
                    // Find website
                    const websiteSelectors = [
                      'a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"]):not([href*="apollo.io"]):not([href*="zenprospect"])',
                      'a[href*="www."]',
                      'a[data-href*="http"]:not([data-href*="linkedin"]):not([data-href*="facebook"]):not([data-href*="twitter"])',
                      'a[data-href*="www."]',
                      ".website a",
                      '[data-testid="website"]',
                      ".company-website a",
                      ".website-link a",
                      '.zp_ycoAs a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      '.zp_FEm_X a[href*="http"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      ".zp_website a",
                      ".zp_company_website a",
                      'a[href^="http"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                      'a[href^="https"]:not([href*="apollo.io"]):not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])',
                    ];
                    let websiteLink = null;
                    for (const websiteSelector of websiteSelectors) {
                      websiteLink = row.querySelector(websiteSelector);
                      if (
                        websiteLink &&
                        websiteLink.href &&
                        !websiteLink.href.includes("apollo.io") &&
                        !websiteLink.href.includes("zenprospect") &&
                        !websiteLink.href.includes("linkedin.com") &&
                        !websiteLink.href.includes("facebook.com") &&
                        !websiteLink.href.includes("twitter.com") &&
                        !websiteLink.href.includes("x.com")
                      ) {
                        break;
                      }
                    }
                    websiteUrl = websiteLink ? websiteLink.href : "";

                    // Find LinkedIn
                    const linkedinSelectors = [
                      'a[href*="linkedin.com"]',
                      'a[href*="linkedin.com/company"]',
                      'a[data-href*="linkedin.com"]',
                      '.zp_ycoAs a[href*="linkedin.com"]',
                      '.zp_FEm_X a[href*="linkedin.com"]',
                      ".zp_linkedin a",
                      ".zp_company_linkedin a",
                      ".linkedin a",
                      ".social-linkedin a",
                      '[data-testid="linkedin"] a',
                    ];
                    let linkedinLink = null;
                    for (const linkedinSelector of linkedinSelectors) {
                      linkedinLink = row.querySelector(linkedinSelector);
                      if (linkedinLink && linkedinLink.href) break;
                    }
                    linkedinUrl = linkedinLink ? linkedinLink.href : "";

                    // Find Facebook
                    const facebookSelectors = [
                      'a[href*="facebook.com"]',
                      'a[href*="fb.com"]',
                      'a[data-href*="facebook.com"]',
                      'a[data-href*="fb.com"]',
                      '.zp_ycoAs a[href*="facebook.com"]',
                      '.zp_FEm_X a[href*="facebook.com"]',
                      ".zp_facebook a",
                      ".zp_company_facebook a",
                      ".facebook a",
                      ".social-facebook a",
                      '[data-testid="facebook"] a',
                    ];
                    let facebookLink = null;
                    for (const facebookSelector of facebookSelectors) {
                      facebookLink = row.querySelector(facebookSelector);
                      if (facebookLink && facebookLink.href) break;
                    }
                    facebookUrl = facebookLink ? facebookLink.href : "";

                    // Find Twitter
                    const twitterSelectors = [
                      'a[href*="twitter.com"]',
                      'a[href*="x.com"]',
                      'a[data-href*="twitter.com"]',
                      'a[data-href*="x.com"]',
                      '.zp_ycoAs a[href*="twitter.com"]',
                      '.zp_FEm_X a[href*="twitter.com"]',
                      ".zp_twitter a",
                      ".zp_company_twitter a",
                      ".twitter a",
                      ".social-twitter a",
                      '[data-testid="twitter"] a',
                    ];
                    let twitterLink = null;
                    for (const twitterSelector of twitterSelectors) {
                      twitterLink = row.querySelector(twitterSelector);
                      if (twitterLink && twitterLink.href) break;
                    }
                    twitterUrl = twitterLink ? twitterLink.href : "";
                  }

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
                    method: "full_page_scan",
                  });
                }
              } catch (error) {
                logger.error(`All pages scanning row ${index} error:`, error);
              }
            });
          }

          return companyRows;
        },
        foundSelector,
        Logger
      );

      return companies;
    } catch (error) {
      Logger.error("Page data scraping error:", error);
      // Take screenshot on error
      try {
        await this.browserManager
          .getPage()
          .screenshot({ path: "error-page.png", fullPage: true });
        Logger.warning("Error screenshot saved: error-page.png");
      } catch (screenshotError) {
        Logger.error("Screenshot error:", screenshotError);
      }
      return [];
    }
  }
}

module.exports = Scraper;
