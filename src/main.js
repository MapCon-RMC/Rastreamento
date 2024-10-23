import { CheerioCrawler, log, RequestQueue } from "crawlee";
import { classifier, filter_URL } from "./classifier.js";
import { 
    removeAccents, 
    extractText,
    extractTitle,
    saveRunStatus, 
    saveToDB, 
    readRunStatus, 
    getArticleDate, 
    cleanURL
} from "./utils.js";
import db from "./db/db.js";

// Environment variables are defined in .env files and imported
// using the dotenv package in the db/db.js file

// Set the log level to DEBUG to see all the logs
log.setLevel(process.env.LOG_LEVEL);

console.debug('Last executions: ')
for (const run of readRunStatus()) {
    console.debug(JSON.stringify(run, null, 4).slice(1, -1));
}

const defaultURLS = [
    "https://www.tribunapr.com.br/noticias/parana/",
    "http://www.brasildefatopr.com.br/",
    "http://www.bemparana.com.br/",
    "http://www.bandab.com.br/",
    "http://bandnewsfmcuritiba.com/",
];

async function runCrawler() {
    // Initialize a request queue
    const requestQueue = await RequestQueue.open();

    // Add starting URLs to the request queue
    for(const URL of defaultURLS) {
        await requestQueue.addRequest({ url: URL });
    }

    const preRunCount = await db.withSchema('crawling').table('crawling_news').count('url');
    const crawler = new CheerioCrawler({
        requestQueue,
        maxRequestRetries: 3,
        failedRequestHandler: async ({ request }) => {
            log.error(`Request ${request.url} failed too many times.`);
        },
        errorHandler: async ({ request, error }) => {
            log.error(`Request ${request.url} failed with error: ${error}`);
        },
        preNavigationHooks: [
            async ({request}) => {
                const blockedExtensions = ['xml', 'png', 'jpg', 'jpeg', 'webp', 'pdf', 'zip'];
                // Check if the URL ends with one of the allowed extensions
                const url = new URL(request.url);
                const path = url.pathname.toLowerCase();

                // If the URL does not end with one of the allowed extensions, skip the request
                if (blockedExtensions.some(ext => path.endsWith(ext))) {
                    log.debug(`Skipping ${request.url} due to unsupported file type.`);
                    request.noRetry = true;
                }
            }
        ],
        async requestHandler({ request, $, body, enqueueLinks }) {
            try {
                const title = extractTitle(body);
                
                const links = $('a[href]')
                    .map((_, el) => $(el).attr('href'))
                    .get();
                
                // Resolving relative URLs, otherwise
                // they would be unusable for crawling.
                const absoluteUrls = links.map(
                    (link) => new URL(link, request.loadedUrl),
                );
                
                // Filtering out the URLs that are not from the same origin.                
                const { origin } = new URL(request.loadedUrl);
                const sameOriginUrls = absoluteUrls
                    .filter((url) => url.origin === origin)
                    .map((url) => url.href);

                // Creating an object with the data scraped from the current page
                const data = {
                    url          : cleanURL(request.loadedUrl),
                    cidades      : JSON.stringify([{"uf": "PR", "municipio": "Curitiba", "populacao": 1933105}]),  // Must be a JSON string before inserting
                    titulo       : removeAccents(title),
                    data_insercao: new Date(),
                    termos       : [],
                    content      : extractText(body),  // Make content last to improve readability
                    data         : '',
                    tipo         : 'f',
                };
                
                // Saving the data scraped from the current page to
                // the dataset if it passes the 'is article' filters.
                if (filter_URL(request.loadedUrl)) {
                    const [protesto, termos] = classifier(data.content);
                    data.tipo = protesto === true ? 't' : 'f';
                    data.data = await getArticleDate(data.url);
                    data.termos = termos.map(termo => removeAccents(termo));
                    // await Dataset.pushData(data);
                    if (data.tipo === 't') {
                        await saveToDB(data);
                    }
                    log.debug(`URL: ${data.url} -  \u001b[34m Protesto: ${data.tipo}\u001b[0m - \u001b[32m Title: ${title}!\u001b[0m, \u001b[31m Termos: ${data.termos}\u001b[0m`);
                }
                
                // Finally, we have to add the URLs to the queue
                // await crawler.addRequests(sameOriginUrls);
                await enqueueLinks({
                    urls: sameOriginUrls,
                    strategy: 'same-hostname',
                });
            } catch (error) {
                console.error('ERROR: ', error);
            }
        },
        maxRequestsPerCrawl: Number(process.env.MAX_REQUESTS_PER_CRAWLER),
    });

    // Run the crawler with the default URLs
    await crawler.run();
    const postRunCount = await db.withSchema('crawling').table('crawling_news').count('url');
    const run_additions = postRunCount[0]['count'] - preRunCount[0]['count'];
    console.log(`Tried adding: ${run_additions} new entries`);
    console.debug('Status: ', saveRunStatus({additions: run_additions}));
}


// Schedule the crawler to run every day at midnight
// cron.schedule('0 0 * * *', async () => {
//     const date = new Date();
//     console.log(`Running Crawler at ${formatDate(date)}`);

//     // Run the crawler with the default URLs
//     await crawler.run(defaultURLS);
//     console.debug('Status: ', saveRunStatus());
// });

const crawl = async() => {
    await runCrawler();
};

crawl().then(() => {
    console.log('Crawler finished, exiting...');
    process.exit(0);
}).catch((error) => {
    console.error('Crawler failed: ', error);
    process.exit(1);
});
