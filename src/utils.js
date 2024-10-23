import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { log } from 'crawlee';
import axios from "axios";
import db from "./db/db.js";

// Define global path variable
const FILE_PATH = 'runStatus.log';

// Function to remove accented characters
export function removeAccents(str) {
    // Regex to match any character with the Unicode property 'diacritic'
    const regex = /[\u0300-\u036f\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;
    
    // Normalize the string to decompose combined characters into their individual components
    const normalizedStr = str.normalize('NFD');
    
    // Replace the accented characters using the regex
    let cleanStr = normalizedStr.replace(regex, '');
    cleanStr = cleanStr.replace(/“|”/g, '');
    
    return cleanStr.normalize('NFC'); // Normalize back to NFC form (optional)
}

// Function to extract only the relevant text from the HTML body
export function extractText(URL, html) {
    // Load the HTML into cheeri
    const $ = cheerio.load(html);
    let text = '';
    if (URL.includes("www.tribunapr.com.br/")) {
        text = $('section.texto-materia p').not(':has(a)').text();
    } else if (URL.includes("www.brasildefatopr.com.br/")) {
        text = $('div.text-content p').not(':has(a)').not(':has(img)').text();
    } else if (URL.includes("www.bemparana.com.br/")) {
        text = $('div.post-content p').not(':has(a)').not(':has(img)').text();
    } else if (URL.includes("bandnewsfmcuritiba.com/")) {
        text = $('article.post-content p').not(':has(img)').not('.img-caption-text').text();
    } else if (URL.includes("www.bandab.com.br/")) {
        text = $('div.post-content p').not(':has(img)').text();
    }

    // Remove any urls from the text
    text = text.replace(/(https?:\/\/[^\s]+)/g, '');

    // Replace any characters that can be misinterpreted by the tokenizer
    text = text.replace(/[\t\n]/g, ' ');

    // Remove dangerous characters from the text (e.g., quotes, backticks, empty characters, single and double quotation marks and U+00a0 non-breaking space)
    text = text.replace(/["'`‘’“”]/g, '');
    text = text.replace(/\u00a0/g, ' ');

    // Replace U+2013 (en dash) and U+2014 (em dash) characters by the common dash
    text = text.replace(/[\u2013\u2014]/g, '-');

    // Extract and return the text from the modified HTML
    return text;
}

// Function to extract the correct title of the articles
export function extractTitle(html) {
    // Load the HTML into cheerio
    const $ = cheerio.load(html);

    // Extract the title from the HTML
    const matches = $('h1[class*="title"]').map((i, el) => $(el).text()).get();
    let title = '';
    if (matches.length === 0) {
        title = $('title').text();
    } else {
        title = matches.reduce((acc, el) => {return el.length > acc.length ? el : acc});
    }

    // Remove any leading or trailing whitespace
    title = title.trim();

    return title;
}


// Function to concatenate two JSON objects
function jsonConcat(o1, o2) {
    for (let key in o2) {
     o1[key] = o2[key];
    }
    return o1;
}

// Function to format a date object into a string
export function formatDate(date) {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
};

// Function to get the current DAY and TIME and append it to a JSON 
// file and returning the JSON object
export function saveRunStatus(run) {
    fs.open(FILE_PATH, 'a', (err, fd) => {
        if (err) {
            console.error(`Error opening the file: ${err}`);
        } else {
            fs.readFile(FILE_PATH, 'utf8', (err, data) => {
                if (err) {
                    console.error(`Error reading the file: ${err}`);
                } else {
                    fs.close(fd, (err) => {
                        if (err) {
                            console.error(`Error closing the file: ${err}`);
                        }
                    });
                }
            });
        }
    });

    const date = new Date();
    let runStatus = {
        day: date.toLocaleDateString('en-GB'),
        time: date.toLocaleTimeString(),
    };

    runStatus = jsonConcat(runStatus, run);

    // Append the run status to the file
    fs.appendFileSync(FILE_PATH, JSON.stringify(runStatus) + '\n');

    return runStatus;
}

// Function to read the data from the JSON/LOG file and
// parse it into JSON objects
export function readRunStatus() {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        const runStatus = data.split('\n')
                              .filter(line => line.trim() !== '')
                              .map(line => {return JSON.parse(line)});
        return runStatus;
    } catch (err) {
        if(err.code === 'ENOENT') {
            console.debug('The file does not exist.');
            return [];
        } else {
            console.error(`Error reading the file: ${err}`);
        }
    }
}

// Function to retrieve the date of an article from a given URL
const dateRegex = /\/(\d{4})\/(\d{2})\/(\d{2})\//;
export async function getArticleDate(url) {
    try {
        const match = url.match(dateRegex);
        if (match !== null) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }

        // Fetch the HTML content of the article
        const { data } = await axios.get(url);
        
        // Regular expression to filter only the date (and not time)
        const reg = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;

        // Load the HTML into Cheerio
        const $ = cheerio.load(data);
        
        // Example 1: Date in a <meta> tag
        let date = $('meta[property="article:published_time"]').attr('content');
        if (date) return date.match(reg)[0];
        
        // Example 2: Date in a <time> tag
        date = $('time[datetime]').attr('datetime');
        if (date) return date.match(reg)[0];
        
        // Example 3: Date in a specific class or ID
        date = $('.publish-date').text();
        if (date) return date.trim().match(reg)[0];
        
        date = $('#publish-date').text();
        if (date) return date.trim().match(reg)[0];

        // Example 4: Date in a <span> tag with class "published updated"
        date = $('span.published').attr('rel');
        if (date) return date.match(reg)[0];
        
        // If none of the above selectors match, return null or an appropriate message
        return 'Date not found';
    } catch (error) {
        console.error('Error fetching article date:', error);
        return 'Error fetching article date';
    }
}

// Function to save the crawled data to the DATABASE
export async function saveToDB(data) {
    try {
        // Insert the data into the database
        const res = await db.withSchema('crawling').table('crawling_news').insert(data);
        log.debug(res);
        return 1;
    } catch (error) {
        log.debug('Error inserting data into the database: ');
        // Handle specific error cases, for example if the requested URL is already saved
        if (error.code === '23505') {
            log.debug('URL already exists in the database');
        } else {
            log.error(error);
        }
        return 0;
    }
}

// Function to filter out URLs to be used as primary keys on the DB
export function cleanURL(url) {
    try {
      const urlObj = new URL(url);
      // Constructing the base URL without the search and hash parts
      return urlObj.origin + urlObj.pathname;
    } catch (error) {
      log.error('Invalid URL:', error);
      return null;
    }
}