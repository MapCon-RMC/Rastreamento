import puppeteer from 'puppeteer';

// 3A -> :
// 2F -> /
// 7C -> |
// 2C -> ,
function formatURL(url) {
    const begin = "https://www.google.com/search?q=site:";
    let splitURL = url.split(begin)[1];
    let formattedURL = splitURL.replace(/:/g, '%3A');
    formattedURL = formattedURL.replace(/\//g, '%2F');
    formattedURL = formattedURL.replace(/\|/g, '%7C');
    formattedURL = formattedURL.replace(/,/g, '%2C');
    return begin + formattedURL;
}

const defaultURLS = [
    "www.tribunapr.com.br/noticias/parana/",
    "www.brasildefatopr.com.br/",
    "www.bemparana.com.br/",
    "www.bandab.com.br/",
    "bandnewsfmcuritiba.com/",
];

// Dates in format: MM/DD/YYYY
function makeQuery(website_url, start_date, end_date) {
    let googleQueryURL = `https://www.google.com/search?q=site:${website_url}&tbs=cdr:1,cd_min:${start_date},cd_max:${end_date}`;
    return formatURL(googleQueryURL);
}

async function retrieveLinks(page, query) {
    let links = [];
    let resultsLeft = true;

    while (resultsLeft) {
        // Navigate to the query URL and wait until the page is fully loaded
        await page.goto(query + `&start=${links.length}`, { waitUntil: 'networkidle2' });

        // Extract all href attributes of <a> tags with attribute jsname='UWckNb'
        await page.$$eval("a[jsname='UWckNb']", (elements) =>
            elements.map((el) => el.href)
        ).then((hrefs) => {
            if (hrefs.length === 0) {
                resultsLeft = false;
            } else {
                links.push(...hrefs);
            }
        });
    }

    return links;
}

async function main() {
    let query = makeQuery(defaultURLS[0], "01/01/2022", "01/01/2023");
    console.log(`Query: ${query}`);

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const links = await retrieveLinks(page, query);
    
    console.log("Num. of links: ", links.length);

    // Close the browser
    await browser.close();
}

main();