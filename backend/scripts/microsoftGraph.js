// microsoftGraph.js
const msal = require('@azure/msal-node');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // Import exec to run the Edge command

// Replace these values with your tenant information
const clientId = '7a998675-357c-49ea-a462-fcf70afd6557';
const tenantId = 'b428d519-22b4-458f-af45-f020150f5839';

// Authority URL
const authorityUrl = `https://login.microsoftonline.com/${tenantId}`;

// The scope needed to access the calendar
const scopes = ["Calendars.ReadWrite"];

// Create a MSAL public client application
const msalConfig = {
    auth: {
        clientId: clientId,
        authority: authorityUrl,
    }
};

// Cache file location
const cacheFilePath = path.join(__dirname, 'token_cache.json');

const cca = new msal.PublicClientApplication(msalConfig);

// Function to load cache from file
function loadCache() {
    console.log('Attempting to load cache from file:', cacheFilePath); // Log the cache file path
    if (fs.existsSync(cacheFilePath)) {
        console.log('Cache file exists. Reading data...'); // Log when the cache file exists
        const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
        console.log('Cache data loaded successfully.'); // Log successful data load
        return JSON.parse(cacheData);
    }
    console.log('Cache file does not exist. Returning null.'); // Log when the cache file does not exist
    return null;
}

// Function to save cache to file
function saveCache(cache) {
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache), 'utf8');
}

// Load cache
const cache = loadCache();
if (cache) {
    cca.tokenCache.deserialize(cache);
}

async function getAccessToken() {
    let tokenResponse;

    try {
        // Attempt to acquire token silently (from cache)
        const accounts = await cca.getAllAccounts();
        console.log('Accounts in cache:', accounts);
        
        if (accounts.length > 0) {
            console.log('Attempting to acquire token silently...');
            tokenResponse = await cca.acquireTokenSilent({
                scopes: scopes,
                account: accounts[0],
            });
            console.log('Token acquired silently from cache.');
        } else {
            console.log('No accounts found in cache.');
        }

        // Check if silent acquisition returned a valid token
        if (!tokenResponse) {
            console.log('Silent token acquisition did not return a valid token. Attempting device code flow...');
            // Attempt to acquire token interactively
            const deviceCodeResponse = await cca.acquireTokenByDeviceCode({
                scopes,
                deviceCodeCallback: (response) => {
                  console.log('Device code flow response message:', response.message);
                  console.log('Please open the following URL and enter the code to authenticate:');
                  console.log(`  URL:       ${response.verificationUri}`);
                  console.log(`  User Code: ${response.userCode}`);
              
                  let cmd;
                  if (process.platform === 'win32') {
                    cmd = `start microsoft-edge:${response.verificationUri}`;
                  } else if (process.platform === 'darwin') {
                    cmd = `open -a "Microsoft Edge" ${response.verificationUri}`;
                  } else {
                    cmd = `xdg-open ${response.verificationUri}`;
                    // or to prefer Edge on Linux:
                    // cmd = `microsoft-edge ${response.verificationUri} || xdg-open ${response.verificationUri}`;
                  }
              
                  exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                      console.error('Failed to launch browser:', error);
                    }
                  });
                }
              });
            tokenResponse = deviceCodeResponse;
            console.log('Token acquired interactively using device code.');
        }

    } catch (error) {
        console.error('Unexpected error during token acquisition:', error);
        throw error;
    }

    if (tokenResponse) {
        // Save the cache after acquiring the token
        saveCache(cca.tokenCache.serialize());
        return tokenResponse.accessToken;
    } else {
        throw new Error("Failed to acquire token");
    }
}




async function createAxiosInstance() {
    const accessToken = await getAccessToken();
    return axios.create({
        baseURL: 'https://graph.microsoft.com/v1.0/',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
}

// Function to list calendar events
async function listCalendarEvents() {
    console.log('Creating Axios instance to fetch calendar events...');
    const axiosInstance = await createAxiosInstance();
    console.log('Axios instance created successfully.');

    try {
        console.log('Sending request to fetch calendar events...');
        const response = await axiosInstance.get('me/events');
        console.log(`Received response with status: ${response.status}`);
        console.log(`Fetched ${response.data.value.length} event(s).`);
        return response.data.value;
    } catch (error) {
        console.error('Error fetching calendar events:', error.response?.status);
        console.error('Error details:', error.message);
        throw error;
    }
}

// Function to create a calendar event
async function createCalendarEvent(subject, startDateTime, endDateTime, timeZone = 'UTC') {
    const axiosInstance = await createAxiosInstance();
    try {
        const newEvent = {
            subject: subject,
            start: {
                dateTime: startDateTime,
                timeZone: timeZone
            },
            end: {
                dateTime: endDateTime,
                timeZone: timeZone
            }
        };

        const response = await axiosInstance.post('me/events', newEvent);
        return response.data;
    } catch (error) {
        console.error('Error creating calendar event:', error.response?.status);
        throw error;
    }
}

module.exports = {
    listCalendarEvents,
    createCalendarEvent
};
