const Logger = require("./logger");

class Scraper {
  constructor(browserManager, dataService) {
    this.browserManager = browserManager;
    this.dataService = dataService;
  }

  async scrapeCompanies(maxPages = 5) {
    try {
      Logger.info(
        `Scraping company data... (${maxPages} pages + ${maxPages} more pages with reverse sorting)`
      );

      // First 5 pages (recommendations_score descending)
      Logger.info(
        "Scraping first 5 pages (recommendations_score descending)..."
      );
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        Logger.info(`Processing page ${pageNum}...`);

        // Wait for page to load
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Extract company data
        const pageCompanies = await this.extractCompaniesFromPage();
        this.dataService.addCompanies(pageCompanies);

        Logger.info(`Page ${pageNum}: Found ${pageCompanies.length} companies`);

        // Go to next page (if exists)
        if (pageNum < maxPages) {
          const hasNextPage = await this.goToNextPage();
          if (!hasNextPage) {
            Logger.info("Next page not found, first section completed");
            break;
          }
        }
      }

      Logger.success(
        `First ${maxPages} pages completed. Total ${
          this.dataService.getCompanies().length
        } companies collected.`
      );

      // Change sorting to name ascending
      Logger.info("Changing sorting: name ascending...");
      await this.changeSortingToNameAscending();

      // Second 5 pages (name ascending)
      Logger.info("Scraping second 5 pages (name ascending)...");
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        Logger.info(`Processing page ${pageNum} (name ascending)...`);

        // Wait for page to load
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Extract company data
        const pageCompanies = await this.extractCompaniesFromPage();
        this.dataService.addCompanies(pageCompanies);

        Logger.info(
          `Page ${pageNum} (name ascending): Found ${pageCompanies.length} companies`
        );

        // Go to next page (if exists)
        if (pageNum < maxPages) {
          const hasNextPage = await this.goToNextPage();
          if (!hasNextPage) {
            Logger.info("Next page not found, second section completed");
            break;
          }
        }
      }

      Logger.success(
        `Total ${
          this.dataService.getCompanies().length
        } company data collected (${maxPages} pages descending + ${maxPages} pages ascending)`
      );
    } catch (error) {
      Logger.error("Data scraping error:", error);
      throw error;
    }
  }

  async changeSortingToNameAscending() {
    try {
      Logger.info("Looking for sort button...");

      // Find sort button
      const sortSelectors = [
        'button[aria-label*="sort"]',
        'button[aria-label*="Sort"]',
        'button[data-testid*="sort"]',
        'button[data-testid*="Sort"]',
        ".sort-button",
        ".sort-btn",
        'button[class*="sort"]',
        'button[class*="Sort"]',
        // Apollo.io specific selectors
        'button[aria-label="Sort by"]',
        'button[aria-label="Sort"]',
        'button[data-testid="sort-button"]',
        'button[data-testid="sort"]',
        // Dropdown or select element
        'select[data-testid*="sort"]',
        'select[class*="sort"]',
        // More general selectors
        'button:contains("Sort")',
        'button:contains("sort")',
        '[role="button"]:contains("Sort")',
        '[role="button"]:contains("sort")',
      ];

      let sortButton = null;
      for (const selector of sortSelectors) {
        try {
          sortButton = await this.browserManager.getPage().$(selector);
          if (sortButton) {
            Logger.success(`Sort button found: ${selector}`);
            break;
          }
        } catch (error) {
          // Selector not found, continue
        }
      }

      if (sortButton) {
        try {
          // Click sort button
          await sortButton.click();
          Logger.success("Sort button clicked");

          // Wait for dropdown menu to open
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Find name ascending option and click
          const nameAscendingSelectors = [
            'button:contains("Name")',
            'button:contains("name")',
            'button:contains("Company Name")',
            'button:contains("company name")',
            'button:contains("Organization Name")',
            'button:contains("organization name")',
            '[data-testid*="name"]',
            '[data-testid*="Name"]',
            'li:contains("Name")',
            'li:contains("name")',
            'div:contains("Name")',
            'div:contains("name")',
            // For ascending
            'button:contains("A-Z")',
            'button:contains("Ascending")',
            'button:contains("ascending")',
            '[data-testid*="ascending"]',
            '[data-testid*="Ascending"]',
          ];

          let nameOption = null;
          for (const selector of nameAscendingSelectors) {
            try {
              nameOption = await this.browserManager.getPage().$(selector);
              if (nameOption) {
                Logger.success(`Name ascending option found: ${selector}`);
                break;
              }
            } catch (error) {
              // Selector not found, continue
            }
          }

          if (nameOption) {
            await nameOption.click();
            Logger.success("Name ascending selected");

            // Wait for page to load
            await new Promise((resolve) => setTimeout(resolve, 5000));

            // Check if sorting change is visible in URL
            const newUrl = this.browserManager.getPage().url();
            if (
              newUrl.includes("sortByField=name") ||
              newUrl.includes("sortAscending=true")
            ) {
              Logger.success("Sorting changed successfully");
            } else {
              Logger.warning("Sorting change not visible in URL");
            }
          } else {
            Logger.warning("Name ascending option not found");
            // Alternative: Change sorting via URL
            await this.changeSortingViaURL();
          }
        } catch (error) {
          Logger.error("Sorting change error:", error);
          // Alternative: Change sorting via URL
          await this.changeSortingViaURL();
        }
      } else {
        Logger.warning("Sort button not found, changing via URL...");
        await this.changeSortingViaURL();
      }
    } catch (error) {
      Logger.error("General sorting change error:", error);
      await this.changeSortingViaURL();
    }
  }

  async changeSortingViaURL() {
    try {
      Logger.info("Changing sorting via URL...");

      // Get current URL
      const currentUrl = this.browserManager.getPage().url();
      Logger.info(`Current URL: ${currentUrl}`);

      // Change sorting parameters in URL
      let newUrl = currentUrl;

      // If sortByField exists, change it, otherwise add it
      if (newUrl.includes("sortByField=")) {
        newUrl = newUrl.replace(/sortByField=[^&]*/, "sortByField=name");
      } else {
        newUrl += (newUrl.includes("?") ? "&" : "?") + "sortByField=name";
      }

      // Add sortAscending=true
      if (newUrl.includes("sortAscending=")) {
        newUrl = newUrl.replace(/sortAscending=[^&]*/, "sortAscending=true");
      } else {
        newUrl += "&sortAscending=true";
      }

      // Set page number to 1
      if (newUrl.includes("page=")) {
        newUrl = newUrl.replace(/page=\d+/, "page=1");
      } else {
        newUrl += "&page=1";
      }

      Logger.info(`New URL: ${newUrl}`);

      // Go to new URL
      await this.browserManager.getPage().goto(newUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      Logger.success("Sorting changed successfully via URL");
    } catch (error) {
      Logger.error("URL sorting change error:", error);
    }
  }

  async goToNextPage() {
    try {
      const nextButtonSelectors = [
        'button[aria-label="Next page"]',
        'button[aria-label="Next"]',
        'button[data-testid="next-page"]',
        'button[data-testid="pagination-next"]',
        ".pagination-next",
        ".next-page",
        'a[aria-label="Next page"]',
        'a[aria-label="Next"]',
        '[data-testid="next-page"]',
        '[data-testid="pagination-next"]',
        // Apollo.io spesifik selector'lar
        'button[class*="next"]',
        'button[class*="Next"]',
        'a[class*="next"]',
        'a[class*="Next"]',
        // Sayfa numarası ile
        `button:contains("${this.getCurrentPageNumber() + 1}")`,
        `a:contains("${this.getCurrentPageNumber() + 1}")`,
      ];

      let nextButton = null;
      for (const selector of nextButtonSelectors) {
        try {
          nextButton = await this.browserManager.getPage().$(selector);
          if (nextButton) {
            Logger.success(`Pagination button found: ${selector}`);
            break;
          }
        } catch (error) {
          // Selector not found, continue
        }
      }

      if (nextButton) {
        try {
          await nextButton.click();
          Logger.success(`Moved to next page`);

          // Wait for page to load
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Check if page number is changed in URL
          const newUrl = this.browserManager.getPage().url();
          const expectedPage = this.getCurrentPageNumber() + 1;
          if (newUrl.includes(`page=${expectedPage}`)) {
            Logger.success(`Page ${expectedPage} verified in URL`);
          } else {
            Logger.warning(`Page change not verified in URL: ${newUrl}`);
          }
          return true;
        } catch (error) {
          Logger.error(`Next page navigation error:`, error);
          return false;
        }
      } else {
        Logger.warning("Next page not found");
        return false;
      }
    } catch (error) {
      Logger.error("Pagination error:", error);
      return false;
    }
  }

  getCurrentPageNumber() {
    try {
      const url = this.browserManager.getPage().url();
      const match = url.match(/page=(\d+)/);
      return match ? parseInt(match[1]) : 1;
    } catch (error) {
      return 1;
    }
  }

  async extractCompaniesFromPage() {
    try {
      // Debug: Check page structure
      Logger.info("Analyzing page structure...");

      // First wait for page to load
      Logger.info("Waiting for page to load...");
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // Wait for company data to load
      try {
        await this.browserManager
          .getPage()
          .waitForSelector(".zp_xvo3G", { timeout: 30000 });
        Logger.success("Company names loaded");
      } catch (error) {
        Logger.warning("Timeout waiting for company names, continuing...");
      }

      // Additional waiting time - Apollo.io's slow loading
      Logger.info("Additional waiting time...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check page HTML
      const pageContent = await this.browserManager.getPage().content();
      Logger.info(`Page content length: ${pageContent.length} characters`);

      // Try different selectors (Apollo.io's new structure)
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

      const companies = await this.browserManager
        .getPage()
        .evaluate((selector) => {
          const companyRows = [];
          const rows = document.querySelectorAll(selector);

          Logger.info(`Found ${rows.length} rows, analyzing...`);

          // Alternative method: Scan the entire page to find company data
          const alternativeMethod = () => {
            Logger.info("Trying alternative method...");

            // Find all company links
            const companyLinks = document.querySelectorAll(
              'a[href*="organizations"]'
            );
            Logger.info(`Found ${companyLinks.length} company links`);

            companyLinks.forEach((link, index) => {
              try {
                const companyName = link.textContent.trim();
                if (companyName && companyName.length > 0) {
                  Logger.info(
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
                Logger.error(`Alternative method row ${index} error:`, error);
              }
            });
          };

          rows.forEach((row, index) => {
            // Debug: Check each row's HTML content
            Logger.warning(
              `Row ${index} HTML:`,
              row.outerHTML.substring(0, 300) + "..."
            );

            // Test all possible selectors for company name
            Logger.warning(`Testing selectors for row ${index}...`);

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
                  Logger.warning(
                    `Company name found: "${nameElement.textContent.trim()}" (selector: ${nameSelector})`
                  );
                  break;
                }
              }

              if (!nameElement || !nameElement.textContent.trim()) {
                Logger.warning(`Row ${index}: Company name not found`);
                Logger.warning(`selectors that tried`, nameSelectors);

                // Alternative method: Check all text content
                const allText = row.textContent.trim();
                if (allText.length > 0) {
                  Logger.warning(
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

              Logger.info(
                `Company found: ${companyName} (${companySize} employees, ${companyLocation})`
              );
            } catch (error) {
              Logger.error(`Error processing row ${index}:`, error);
            }
          });

          // If normal method failed, try alternative method
          if (companyRows.length === 0) {
            Logger.warning(
              "Normal method failed, trying alternative method..."
            );
            alternativeMethod();
          }

          // If still no company found, scan all pages to find
          if (companyRows.length === 0) {
            Logger.warning("🔄 Scanning all pages...");

            // Find all company links
            const allCompanyLinks = document.querySelectorAll(
              'a[href*="organizations"], a[data-to*="organizations"]'
            );
            Logger.warning(
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
                  Logger.warning(
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
                Logger.error(`All pages scanning row ${index} error:`, error);
              }
            });
          }

          return companyRows;
        });

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
