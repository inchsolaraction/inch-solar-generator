// Inch Solar Development - Objection Letter Generator V26
// Fixed letter truncation and character encoding in inputs file
// Fixed concern extraction after Tally form field changes
// Complete system with SendGrid, Dropbox, formatted text files, and persistent duplicate prevention
// Uses native redis client instead of @vercel/kv

const https = require('https');
const redis = require('redis');

// Redis client setup - uses REDIS_URL environment variable
let redisClient = null;
let isRedisConnected = false;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.error('REDIS_URL environment variable not set');
      throw new Error('Redis not configured');
    }
    
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('Redis reconnection failed after 3 attempts');
            return new Error('Redis reconnection limit reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isRedisConnected = false;
    });
    
    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
      isRedisConnected = true;
    });
    
    await redisClient.connect();
  }
  
  return redisClient;
}

// Committee Research - Updated for all concern categories
const COMMITTEE_RESEARCH = {
  food_security: `This development would result in the loss of 800+ acres of prime agricultural land. Once converted, this land will be lost to food production for 35+ years, directly contradicting national food security policies and the Food Vision 2030 strategy.`,
  
  river_pollution: `The site's proximity to local waterways raises concerns about potential contamination from panel cleaning chemicals, construction runoff, and battery storage facilities. The developer's environmental impact assessment has not adequately addressed water quality protection measures.`,
  
  well_contamination: `Many local residents rely on private wells for drinking water. The construction phase and ongoing operations pose risks of contamination from chemicals, increased runoff, and changes to groundwater flow patterns that have not been properly assessed.`,
  
  flooding: `This exact site experienced significant flooding during Storm Babet in October 2023. Despite documented flooding events, no comprehensive flood risk assessment addressing climate change impacts has been conducted by the developer. The proposed drainage system is inadequate for extreme weather events.`,
  
  mental_health: `The scale and industrial nature of this development will fundamentally alter the rural character of the area, affecting residents' mental wellbeing, sense of place, and quality of life. The psychological impact of living adjacent to an industrial-scale energy facility has not been assessed.`,
  
  glint_glare: `Solar panel glint and glare can cause significant nuisance to nearby residents and road users. The developer has not provided adequate assessment of reflective impacts on homes within 500m of the development boundary.`,
  
  location_scale: `At over 800 acres, this proposal represents an industrialization of rural landscape on an unprecedented scale for this area. The cumulative impact of multiple large-scale solar developments in East Cork has not been adequately assessed.`,
  
  noise_vibration: `Construction activities will generate significant noise and vibration impacts over an extended period. The operational noise from inverters and transformers has not been properly assessed for impact on nearby residential properties.`,
  
  no_plan: `The application lacks a clear, rational plan for integration with the local area. There is no demonstrated need for this specific location, and alternatives have not been properly considered.`,
  
  lack_legislation: `Current planning legislation is inadequate for developments of this scale. The developer can place panels right up to property boundaries without adequate setback requirements, directly impacting residential amenity.`,
  
  wildlife: `The site contains habitats for protected species including bats, badgers, and various bird species. The ecological impact assessment fails to address habitat fragmentation and the impact on local wildlife corridors.`,
  
  children: `The proximity of the development to local schools and residential areas raises concerns about children's safety during construction, the impact on outdoor play and recreation, and the psychological effects of growing up beside an industrial facility.`,
  
  road_safety: `The narrow rural roads serving this area are unsuitable for the volume of construction traffic required. The developer has not adequately assessed the impact on road safety, particularly for school traffic and agricultural vehicles.`,
  
  road_infrastructure: `Local roads are not designed for heavy construction traffic. The developer has not committed to adequate road improvements or provided guarantees for repair of damage caused by construction vehicles.`,
  
  lack_engagement: `Despite over 200 signatures on a petition requesting it, no public meeting has been held by the developer. This represents a failure to meaningfully engage with the affected community as required under planning guidelines.`,
  
  decommissioning: `The decommissioning plan is vague and provides no financial security for site restoration. Who will bear the cost of decommissioning if the developer becomes insolvent after 35 years?`,
  
  archaeology: `There are 15 recorded monuments within 5km of the proposed site according to the National Monuments Service. The developer's EIAR has inadequately assessed the archaeological impact, particularly concerning Ring forts and Medieval sites in the immediate vicinity.`,
  
  flora_fauna: `The development will result in the permanent loss of agricultural grassland and hedgerows, impacting local biodiversity. The cumulative effect on flora and fauna from this and other developments has not been assessed.`,
  
  privacy: `The industrial scale of the development, including security fencing, cameras, and lighting, will significantly impact the privacy and residential amenity of nearby homes. The developer has not addressed these concerns adequately.`,
  
  visual_impact: `The development will fundamentally alter the rural landscape character of the area. Properties within 2km will experience significant visual impact from panels, fencing, and infrastructure that cannot be adequately screened.`,
  
  economic_impact: `The development offers minimal long-term local employment while permanently removing agricultural land from productive use. The impact on local agricultural employment and the wider rural economy has not been properly assessed.`,
  
  battery_fire: `Battery storage facilities pose fire risks that have not been adequately assessed. Emergency services have expressed concerns about their capacity to respond to battery fires, and evacuation procedures for nearby residents have not been established.`,
  
  property_devaluation: `Properties within 500m of industrial-scale solar farms have documented impacts on property values, visual amenity, and quality of life. These impacts are not adequately addressed in the developer's assessment.`,
  
  agricultural_land: `This development would result in the loss of 800+ acres of prime agricultural land for 35+ years, directly contradicting Food Vision 2030 and national food security policies.`,
  
  security: `The security requirements for the site, including fencing, CCTV, and lighting, will create an industrial appearance and impact on the rural character. Security measures and their visual impact have not been properly addressed.`,
  
  quality_components: `Questions remain about the quality and origin of electrical and mechanical components. The developer has not provided adequate guarantees about component quality, efficiency ratings, or replacement schedules.`,
  
  industrialisation: `This development represents the industrialization of a rural area. The cumulative impact of multiple renewable energy developments in the region threatens the rural character and agricultural economy of East Cork.`,
  
  air_traffic: `The potential impact on air traffic, including helicopters using nearby routes, has not been adequately assessed. Solar panel glare could affect aviation safety.`,
  
  existing_renewables: `There are already numerous renewable energy applications and developments in Cork and West Waterford. The cumulative impact assessment is inadequate and does not consider the totality of renewable energy infrastructure in the region.`,
  
  adjacent_renewables: `The cumulative impact of this development alongside existing and proposed renewable developments in the immediate area has not been properly assessed. The region is reaching saturation point for industrial-scale renewable infrastructure.`
};

// Helper function to make HTTPS requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Clean text
function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/"/g, "'")
    .replace(/\\/g, '')
    .trim();
}

// Extract last two lines of address, remove eircode and counties
function formatAddress(fullAddress) {
  if (!fullAddress) return '';
  
  // List of 32 Irish counties to remove
  const countyPatterns = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 
    'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 
    'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 
    'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 
    'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
  ];
  
  // Remove eircode (pattern: Letter+2digits+4alphanumeric)
  let cleaned = fullAddress.replace(/\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/gi, '').trim();
  
  // Remove county names
  countyPatterns.forEach(county => {
    const regex = new RegExp(`\\b(Co\\.?\\s+)?${county}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '').trim();
  });
  
  // Clean up multiple spaces, commas
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/,\s*$/g, '').replace(/^\s*,\s*/, '').trim();
  
  return cleaned;
}

// Create formatted text file for inputs
function createInputsTextFile(formData, firstName, lastName, selectedConcernLabels = []) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  
  let content = `Respondent: ${firstName} ${lastName}\n`;
  content += `Generated: ${timestamp}\n\n`;
  content += `${'='.repeat(80)}\n`;
  content += `RESPONDENT INFORMATION\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Add basic fields
  const basicFields = ['First Name', 'Last name', 'Email', 'Address', 'What do you work at?'];
  const distanceField = 'How close do you live to the proposed solar development?';
  
  if (formData['First Name']) content += `First Name: ${formData['First Name']}\n\n`;
  if (formData['Last name']) content += `Last Name: ${formData['Last name']}\n\n`;
  if (formData['Email']) content += `Email: ${formData['Email']}\n\n`;
  if (formData['Address']) content += `Address:\n${formData['Address']}\n\n`;
  if (formData[distanceField]) content += `Distance from Development: ${formData[distanceField]}\n\n`;
  if (formData['What do you work at?']) content += `Occupation: ${formData['What do you work at?']}\n\n`;
  
  content += `${'='.repeat(80)}\n`;
  content += `SELECTED CONCERNS\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Show the concerns that were selected (checkboxes checked)
  if (selectedConcernLabels && selectedConcernLabels.length > 0) {
    selectedConcernLabels.forEach((label, index) => {
      content += `${index + 1}. ${label}\n`;
    });
    content += `\n`;
  } else {
    content += `(No concerns selected)\n\n`;
  }
  
  content += `${'='.repeat(80)}\n`;
  content += `DETAILED CONCERNS\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Add all concern detail fields WHERE USER WROTE SOMETHING
  const concernFields = Object.entries(formData).filter(([key]) => 
    key.startsWith('What are your concerns around')
  );
  
  for (const [key, value] of concernFields) {
    if (value && value.trim()) {
      const cleanKey = key.replace(/^What are your concerns around /, '').replace(/\n/g, '').trim();
      content += `${cleanKey}:\n${value}\n\n`;
    }
  }
  
  // Also show concerns that were SELECTED but have NO details written
  if (selectedConcernLabels && selectedConcernLabels.length > 0) {
    const detailedConcerns = concernFields
      .filter(([, value]) => value && value.trim())
      .map(([key]) => key.replace(/^What are your concerns around /, '').replace(/\n/g, '').trim());
    
    const concernsWithoutDetails = selectedConcernLabels.filter(
      label => !detailedConcerns.some(dc => label.includes(dc) || dc.includes(label.split('/')[0]))
    );
    
    if (concernsWithoutDetails.length > 0) {
      content += `\nConcerns selected (no additional details provided):\n`;
      concernsWithoutDetails.forEach(label => {
        content += `- ${label}\n`;  // Use simple dash instead of bullet to avoid encoding issues
      });
      content += `\n`;
    }
  }
  
  // Add additional fields
  if (formData['Do you have additional concerns that are were not listed?']) {
    content += `${'='.repeat(80)}\n`;
    content += `ADDITIONAL CONCERNS\n`;
    content += `${'='.repeat(80)}\n\n`;
    content += `${formData['Do you have additional concerns that are were not listed?']}\n\n`;
  }
  
  if (formData['Out of the concerns you have selected or mentioned above, are there any that are most important to you?']) {
    content += `${'='.repeat(80)}\n`;
    content += `MOST IMPORTANT CONCERNS\n`;
    content += `${'='.repeat(80)}\n\n`;
    content += `${formData['Out of the concerns you have selected or mentioned above, are there any that are most important to you?']}\n\n`;
  }
  
  if (formData['Can you share a personal story and reason you wish to object.']) {
    content += `${'='.repeat(80)}\n`;
    content += `PERSONAL STORY\n`;
    content += `${'='.repeat(80)}\n\n`;
    content += `${formData['Can you share a personal story and reason you wish to object.']}\n\n`;
  }
  
  content += `${'='.repeat(80)}\n`;
  content += `END OF SUBMISSION\n`;
  content += `${'='.repeat(80)}\n`;
  
  return content;
}

// Create formatted text file for letter
function createLetterTextFile(letterText, firstName, lastName) {
  // Just return the letter text without any headers or footers
  return letterText;
}

// Dropbox token management - uses refresh token for long-term access
let cachedAccessToken = null;
let tokenExpiry = 0;

async function getDropboxAccessToken() {
  // If we have a valid cached token, use it
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }
  
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  
  if (!refreshToken || !appKey || !appSecret) {
    console.error('Missing Dropbox credentials. Need: DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET');
    throw new Error('Dropbox not configured');
  }
  
  try {
    console.log('Refreshing Dropbox access token...');
    
    // Build Basic Auth header
    const credentials = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
    
    // Request new access token
    const tokenResponse = await makeRequest(
      {
        hostname: 'api.dropbox.com',
        path: '/oauth2/token',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      },
      `grant_type=refresh_token&refresh_token=${refreshToken}`
    );
    
    if (tokenResponse.access_token) {
      cachedAccessToken = tokenResponse.access_token;
      // Token expires in 4 hours, cache for 3.5 hours to be safe
      tokenExpiry = Date.now() + (3.5 * 60 * 60 * 1000);
      console.log('Dropbox access token refreshed successfully');
      return cachedAccessToken;
    } else {
      throw new Error('No access token in response');
    }
    
  } catch (error) {
    console.error('Failed to refresh Dropbox token:', error.message);
    throw error;
  }
}

// Upload to Dropbox
async function uploadToDropbox(content, fileName, subfolder = '') {
  try {
    // Get valid access token (refreshes if needed)
    const accessToken = await getDropboxAccessToken();
    
    const buffer = Buffer.from(content, 'utf8');
    
    // Build path with subfolder if provided
    const basePath = '/Inch Solar Objections';
    const fullPath = subfolder ? `${basePath}/${subfolder}/${fileName}` : `${basePath}/${fileName}`;
    
    const response = await makeRequest(
      {
        hostname: 'content.dropboxapi.com',
        path: '/2/files/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: fullPath,
            mode: 'add',
            autorename: true,
            mute: false
          })
        }
      },
      buffer
    );
    
    console.log('Uploaded to Dropbox:', fullPath);
    return { success: true, path: response.path_display };
    
  } catch (error) {
    console.error('Dropbox upload failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Send email via SendGrid
async function sendEmailViaSendGrid(to, subject, htmlBody, textBody, attachments) {
  const sendGridKey = process.env.SENDGRID_API_KEY;
  
  if (!sendGridKey) {
    console.log('SENDGRID_API_KEY not configured');
    return { success: false, message: 'SendGrid not configured' };
  }
  
  try {
    const emailData = {
      personalizations: [{
        to: [{ email: to }],
        bcc: [{ email: 'inchsolaraction@gmail.com' }],
        subject: subject
      }],
      from: {
        email: 'noreply@greenhillssolarobjection.com',
        name: 'Inch Killeagh Rural Preservation Group'
      },
      reply_to: {
        email: 'inchsolaraction@gmail.com',
        name: 'Inch Killeagh Rural Preservation Group'
      },
      headers: {
        'X-Priority': '3',  // Normal priority (1=high can trigger spam)
        'X-Entity-Ref-ID': 'inch-solar-objection'
      },
      categories: ['planning-objection', 'community-service'],
      content: [
        { type: 'text/plain', value: textBody },
        { type: 'text/html', value: htmlBody }
      ],
      attachments: attachments || []
    };
    
    const response = await makeRequest(
      {
        hostname: 'api.sendgrid.com',
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendGridKey}`,
          'Content-Type': 'application/json'
        }
      },
      JSON.stringify(emailData)
    );
    
    console.log('Email sent via SendGrid to:', to, 'and inchsolaraction@gmail.com');
    return { success: true };
    
  } catch (error) {
    console.error('SendGrid error:', error.message);
    return { success: false, message: error.message };
  }
}

// Main handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client = null;

  try {
    console.log('Received webhook from Tally');
    
    // Connect to Redis
    client = await getRedisClient();
    
    const webhookData = req.body.data || req.body;
    
    // CRITICAL: Use Tally's submission ID to prevent duplicates with PERSISTENT Redis storage
    const tallySubmissionId = webhookData.submissionId || webhookData.responseId || webhookData.id;
    
    if (tallySubmissionId) {
      // Check Redis if we've already processed this exact submission
      const redisKey = `submission:${tallySubmissionId}`;
      const alreadyProcessed = await client.get(redisKey);
      
      if (alreadyProcessed) {
        console.log('DUPLICATE DETECTED - Tally re-sent submission:', tallySubmissionId);
        console.log('Original processing time:', new Date(parseInt(alreadyProcessed)).toISOString());
        return res.status(200).json({ 
          message: 'Duplicate submission already processed',
          submissionId: tallySubmissionId,
          originalProcessedAt: parseInt(alreadyProcessed),
          status: 'ignored'
        });
      }
      
      // Mark as processed immediately in Redis (expires after 7 days)
      await client.set(redisKey, Date.now().toString(), { EX: 604800 }); // 604800 seconds = 7 days
      console.log('Processing new submission:', tallySubmissionId);
    }
    
    const fields = webhookData.fields || [];
    
    const formData = {};
    fields.forEach(field => {
      if (field.key && field.value !== undefined) {
        formData[field.key] = field.value;
        if (field.label) {
          formData[field.label] = field.value;
        }
      }
    });
    
    // Debug: Log all field keys to help identify address field
    console.log('Form field keys:', Object.keys(formData).join(', '));
    
    // Extract email and name for backup tracking
    let email = String(formData['Email'] || '').trim().toLowerCase();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('Invalid email:', email);
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const firstName = cleanText(formData['First Name'] || '');
    const lastName = cleanText(formData['Last name'] || '');
    
    // Additional check: email-name combination within last 5 minutes (fast re-submission protection)
    // This catches accidental double-clicks even if Tally doesn't send submission ID
    const quickCheckKey = `quick:${email}-${firstName}-${lastName}`;
    const recentSubmission = await client.get(quickCheckKey);
    
    if (recentSubmission) {
      const timeSince = Date.now() - parseInt(recentSubmission);
      if (timeSince < 5 * 60 * 1000) { // 5 minutes
        console.log('DUPLICATE DETECTED - Same person submitted within 5 minutes');
        console.log('Time since last submission:', Math.round(timeSince / 1000), 'seconds');
        return res.status(200).json({ 
          message: 'Duplicate submission - same person within 5 minutes',
          timeSinceLastSubmission: timeSince,
          status: 'ignored'
        });
      }
    }
    
    // Track this email-name combo (expires after 10 minutes)
    await client.set(quickCheckKey, Date.now().toString(), { EX: 600 }); // 600 seconds = 10 minutes
    
    // Also store by backup ID if Tally didn't send submission ID
    if (!tallySubmissionId) {
      const backupKey = `backup:${email}-${firstName}-${lastName}-${Date.now()}`;
      await client.set(backupKey, Date.now().toString(), { EX: 604800 }); // 7 days
      console.log('No Tally submission ID - using backup tracking');
    }
    
    console.log('Processing form submission...');
    
    // UUID to Label Mapping for checkboxes
    const CONCERN_UUID_MAP = {
      'f518f4ed-4ca3-484e-83e5-e06eb8bab2bd': 'Food Security',
      '236b87ce-d703-4e3c-9faa-da60f2a62f1c': 'River Pollution',
      '6fed80ec-85c4-4fa7-8dad-ace71984b121': 'Well contamination',
      '0bad1703-eed9-450d-ac8c-573ac96510e0': 'Flooding',
      'c44bd15e-a1f4-49f1-877c-c936e4eba8a9': 'Mental health',
      '7e3637b5-a09b-4f45-b4cd-37a343ca1d7c': 'Glint and glare',
      '1aa02ff3-9665-4dfb-89fc-2facdfb42e81': 'Location, Scale and size',
      '6fcb5bf8-4562-44e5-962a-c74c1ae2eda4': 'Noise & vibration',
      'be9bc197-9760-475d-a8e7-c435aeab1ebd': 'No clear rational plan',
      '55a4b42b-af2d-4703-90ef-746a3c29e4ed': 'Lack of legislation',
      '4a95b29a-9890-4636-b718-cca262ccd0e1': 'Wildlife/Biodiversity',
      '9ae822bc-3ec3-49b4-a898-3abcd06bd7e0': 'Impact on children',
      'e40e6075-a288-4dcb-8293-d77374893eea': 'Road Safety/Traffic during construction',
      'bd18d4eb-85a6-440a-aded-0a4790ad20e7': 'Road infrastructure',
      'f30bf427-87cf-48bc-9693-3b52dd3d1e37': 'Lack of public engagement',
      '517a7dea-7817-4d1b-a571-5ca116bda89e': 'Decommissioning',
      '5543604c-a04e-4190-9e81-0ea896c43c6d': 'Archaeology',
      '67956962-34be-401c-b51f-50517dd77f26': 'Flora and fauna (horticulture)',
      'd79d22b0-882b-47b4-948f-dc8f3bde69c0': 'Privacy',
      '4e09cc9d-c328-40ef-8e84-1d5caf55a002': 'Visual impact',
      'ccd3686f-eb61-48d4-9a88-c2d3c4321cf7': 'Economic knock-on/loss of jobs',
      '9fe9d950-1d4c-4f96-973b-e810a736faaa': 'Battery Storage fire risk',
      'c8c054e9-8208-42a4-a546-2283acc3c437': 'Devaluation of property',
      '65e6869f-38d0-4162-a9c8-8064f57ba1a7': 'Loss of agricultural land',
      '76fe7eb2-114d-4aa0-8f79-d1d76289fe73': 'Security',
      'b498082f-1545-4336-b708-381de0a72715': 'Quality of electrical and mechanical components',
      '631c55bd-932e-4505-bbf9-9a648217e8c8': 'Industrialisation',
      '2897ae36-1f9c-4021-a26e-14d8bc459bd6': 'Air traffic',
      'cdef6524-62a8-4e70-8f33-2fee54e6a243': 'Existing Renewable applications/developments in Cork/West Waterford',
      'c0f749a6-d4f3-4454-a682-a2e7d976c2fc': 'Adjacent Renewable applications/development in local area'
    };
    
    const DISTANCE_UUID_MAP = {
      '849fda9b-84f1-48e6-9bfa-f24c29a7ea0a': '<50m',
      'ab07a89b-e0b3-4564-827c-bb9c0725cab2': '50-200m',
      'f4eb90ad-4143-4eca-8224-0b9ddcf74fd3': '200-500m',
      '98ba1248-f87b-4b89-9f81-4a57ddd37237': '500-1km',
      '33468851-48d5-4e2c-881d-369540cf00c0': '1-5km',
      'b5893382-0a9e-471f-aa71-263b83b912ea': '5km+'
    };
    
    // Extract basic info (already declared above for duplicate check)
    // const firstName and lastName already declared at line 382-383
    // const email already declared at line 381
    
    // Try multiple possible field names for address
    // The Tally field has ID question_62blDP
    const fullAddress = cleanText(
      formData['question_62blDP'] ||  // Tally question ID
      formData['Address'] || 
      formData['What is your address?'] || 
      formData['Your Address'] ||
      formData['address'] ||
      ''
    );
    
    const letterAddress = formatAddress(fullAddress); // Last 2 lines, no eircode for letter
    
    // Debug logging
    console.log('Full address:', fullAddress);
    console.log('Formatted letter address:', letterAddress);
    
    const distanceRaw = cleanText(formData['How close do you live to the proposed solar development?\n'] || formData['How close do you live to the proposed solar development?'] || '');
    const distance = DISTANCE_UUID_MAP[distanceRaw] || distanceRaw;
    console.log('Distance from development:', distance);
    
    const occupation = cleanText(formData['What do you work at?'] || '');
    
    // Parse selected concerns from checkbox fields
    // Tally sends the main checkbox field with an ARRAY of UUIDs
    let selectedConcernLabels = [];
    
    // Method 1: Check the main question_eREaMx field (contains array of UUIDs)
    const mainCheckboxField = formData['question_eREaMx'];
    
    if (Array.isArray(mainCheckboxField) && mainCheckboxField.length > 0) {
      console.log('Found main checkbox field with', mainCheckboxField.length, 'UUIDs');
      
      // Map UUIDs to labels using CONCERN_UUID_MAP
      mainCheckboxField.forEach(uuid => {
        const label = CONCERN_UUID_MAP[uuid];
        if (label && !selectedConcernLabels.includes(label)) {
          selectedConcernLabels.push(label);
        }
      });
    }
    
    // Method 2: Fallback - try old format field names
    if (selectedConcernLabels.length === 0) {
      const concernsRaw = formData['What are your main concerns with the Solar Development ?\n'] || 
                          formData['What are your main concerns with the Solar Development ?'] || '';
      
      if (Array.isArray(concernsRaw)) {
        concernsRaw.forEach(uuid => {
          const label = CONCERN_UUID_MAP[uuid];
          if (label && !selectedConcernLabels.includes(label)) {
            selectedConcernLabels.push(label);
          }
        });
      } else if (typeof concernsRaw === 'string' && concernsRaw) {
        const uuids = concernsRaw.split(',').map(uuid => uuid.trim()).filter(uuid => uuid);
        uuids.forEach(uuid => {
          const label = CONCERN_UUID_MAP[uuid];
          if (label && !selectedConcernLabels.includes(label)) {
            selectedConcernLabels.push(label);
          }
        });
      }
    }
    
    console.log('Selected concerns:', selectedConcernLabels.length > 0 ? selectedConcernLabels.join(', ') : 'NONE FOUND');
    
    // Dynamic word count based on number of concerns
    // Base: 1200-1400 for 5 or fewer concerns
    // Add ~150 words per additional concern beyond 5
    const concernCount = selectedConcernLabels.length;
    let minWords, maxWords;
    
    if (concernCount <= 5) {
      minWords = 1200;
      maxWords = 1400;
    } else {
      // Add 150 words per concern beyond 5
      const extraConcerns = concernCount - 5;
      minWords = 1200 + (extraConcerns * 150);
      maxWords = 1400 + (extraConcerns * 150);
    }
    
    console.log(`Dynamic word count: ${concernCount} concerns = ${minWords}-${maxWords} words`);
    
    // Extract ALL concern details from the updated form
    const concerns = {
      food_security: cleanText(formData['What are your concerns around Food Security \n'] || formData['What are your concerns around Food Security'] || ''),
      river_pollution: cleanText(formData['What are your concerns around River Pollution\n'] || formData['What are your concerns around River Pollution'] || ''),
      well_contamination: cleanText(formData['What are your concerns around Well Contamination \n'] || formData['What are your concerns around Well Contamination'] || ''),
      flooding: cleanText(formData['What are your concerns around Flooding'] || ''),
      mental_health: cleanText(formData['What are your concerns around Mental health'] || ''),
      glint_glare: cleanText(formData['What are your concerns around Glint and glare'] || ''),
      location_scale: cleanText(formData['What are your concerns around Location, Scale and size'] || ''),
      noise_vibration: cleanText(formData['What are your concerns around Noise & vibration'] || formData['What are your concerns around Noise &amp; vibration'] || ''),
      no_plan: cleanText(formData['What are your concerns around no clear rational plan'] || ''),
      lack_legislation: cleanText(formData['What are your concerns around Lack of legislation'] || ''),
      wildlife: cleanText(formData['What are your concerns around Wildlife/Biodiversity'] || ''),
      children: cleanText(formData['What are your concerns around Impact on children'] || ''),
      road_safety: cleanText(formData['What are your concerns around Road Safety/Traffic during construction'] || ''),
      road_infrastructure: cleanText(formData['What are your concerns around Road infrastructure'] || ''),
      lack_engagement: cleanText(formData['What are your concerns around the Lack of public engagement'] || ''),
      decommissioning: cleanText(formData['What are your concerns around Decommissioning'] || ''),
      archaeology: cleanText(formData['What are your concerns around Archaeology'] || ''),
      flora_fauna: cleanText(formData['What are your concerns around Flora and fauna (horticulture)'] || ''),
      privacy: cleanText(formData['What are your concerns around Privacy'] || ''),
      visual_impact: cleanText(formData['What are your concerns around Visual impact'] || ''),
      economic_impact: cleanText(formData['What are your concerns around Economic knock-on/loss of jobs'] || ''),
      battery_fire: cleanText(formData['What are your concerns around Battery Storage and fire risk'] || formData['What are your concerns around Battery Storage fire risk'] || ''),
      property_devaluation: cleanText(formData['What are your concerns around Devaluation of property'] || ''),
      agricultural_land: cleanText(formData['What are your concerns around Loss of agricultural land'] || ''),
      security: cleanText(formData['What are your concerns around Security'] || ''),
      quality_components: cleanText(formData['What are your concerns around the Quality of electrical and mechanical components?'] || formData['What are your concerns around Quality of electrical and mechanical components'] || ''),
      industrialisation: cleanText(formData['What are your concerns around Industrialisation\n'] || formData['What are your concerns around Industrialisation'] || ''),
      air_traffic: cleanText(formData['What are your concerns around Air traffic?\n'] || formData['What are your concerns around Air traffic'] || ''),
      existing_renewables: cleanText(formData['What are your concerns around existing Renewable applications/developments in Cork/West Waterford'] || ''),
      adjacent_renewables: cleanText(formData['What are your concerns around adjacent Renewable applications/development in local area ?\n'] || formData['What are your concerns around adjacent Renewable applications/development in local area'] || ''),
      additional_concerns: cleanText(formData['Do you have additional concerns that are were not listed?'] || ''),
      most_important: cleanText(formData['Out of the concerns you have selected or mentioned above, are there any that are most important to you?'] || ''),
      personal_story: cleanText(formData['Can you share a personal story and reason you wish to object. \n'] || formData['Can you share a personal story and reason you wish to object.'] || '')
    };
    
    // Build committee context ONLY for selected concerns to reduce token usage
    const buildSelectedContext = (selectedLabels, concerns) => {
      if (selectedLabels.length === 0) return '';
      
      let context = '\n\nSUPPORTING FACTS:\n';
      const factsMap = {
        'Food Security': 'Ireland imports 80% of animal feed and food needs. Taking 800+ acres out of production reduces food security. Ireland exports 90-94% of dairy produce - vital economic contributor. 5-6 million tonnes of grains imported annually. Loss of 1,300 cows = 9.75 million litres milk lost per year.',
        'River Pollution': 'Storm runoff during construction carries sediment and phosphorus into waterways. Panel runoff can transport herbicides, pesticides, and fertilizers. Solar panels contain lead and cadmium - risk if damaged. Tourig River (which flows through site) supplies Youghal town drinking water.',
        'Well contamination': 'Surface runoff from 800+ acre site threatens private wells. Damaged panels can leach hazardous materials (lead, cadmium) into groundwater. Construction phase increases erosion and sediment in wells. Chemical vegetation management poses contamination risk.',
        'Flooding': 'Site at high elevation - altering natural drainage increases downstream flood risk. Storm Babet (October 2023) caused severe local flooding. Large hard surfaces increase runoff speed and volume. Construction erosion worsens flood contamination. Site near floodplains and Tourig River waterway.',
        'Mental health': 'Anxiety over 40-year industrialization of rural landscape. Stress from construction noise, disruption, and uncertainty. Loss of "place attachment" to familiar rural setting. Perceived loss of control over community decisions. Construction phase creates intensive temporary stress.',
        'Glint and glare': 'Panel reflections cause temporary blindness for drivers (especially low sun - morning/evening). Aviation hazard during approach phases. Continuous glare reduces quality of life for nearby homes. Birds mistake reflective panels for water - collision risk. Studies show reduced property values from visual glare.',
        'Location, Scale and size': '250MW farm = 800 acres (450 football pitches). Would provide 5% of Ireland\'s 2030 solar target in ONE location - hugely disproportionate. 220kV substation: 10-15m high industrial structures. Largest solar farm in Ireland, 2nd largest in Europe - no test cases for impacts.',
        'Noise & vibration': 'Construction: Months of pile driving, heavy machinery, diggers - constant noise. Inverters: Hundreds producing constant electrical hum 24/7. Substation transformers: Continuous humming/buzzing day and night. BESS cooling fans: Large battery systems run constantly. Low-frequency hum travels far in quiet countryside - sleep disruption, stress.',
        'No clear rational plan': 'No specific areas designated in national or county plans for utility-scale solar. Government guidelines delayed until 2027 minimum. National plan requires feasibility studies near industrial parks/brownfield sites first - not prime agricultural land. High-value landscapes like Inch Killeagh deemed "sensitive areas". Multiple agencies (DECC, SEAI) should conduct studies - not single private company.',
        'Lack of legislation': 'Planning Act 2000 requires EIA for scale, cumulative impact, habitat assessment. No national standards for utility-scale solar (unlike homes/businesses). Cork Council plan requires protection of: natural heritage, biodiversity, cultural heritage, scenic amenity, archaeological sites. Strategic Flood Risk Assessment required for elevated sites.',
        'Wildlife/Biodiversity': 'Desktop studies insufficient - only handful of surveyor visits noted. 2+ million sq meters of panels covering 800+ acres. TB-positive badger setts on site - relocation spreads disease. Deer population displaced by fencing - increased road hazards. Protected species: Hares, hedgehogs, pine martens, red squirrels, badgers, bats, barn owls. Tourig River SAC protects lamprey species - pollution threatens conservation area.',
        'Impact on children': '2025 Nature study: Chronic noise harms mental health, disrupts sleep, increases stress hormones, causes brain inflammation. Children with additional needs particularly affected. American Public Health Association links noise to cardiovascular issues, cognitive/emotional disorders in children. WHO: Persistent noise disrupts sleep, raises blood pressure, increases stress - especially harmful in quiet rural areas where ambient noise is low.',
        'Road Safety/Traffic during construction': 'Narrow rural roads built for 2 cars - impossible for HGVs up to 16.5m (54 feet). Heavy machinery, 20ft/40ft shipping containers on narrow roads. Increased deer on roads fleeing construction. Danger to children, walkers, cyclists, horse riders. Extended stop/go systems increase traffic jams. Wexford solar farm residents report "biggest vehicles ever seen".',
        'Road infrastructure': 'Local roads modestly maintained - no indication of upgrades planned. Heavy agricultural vehicles PLUS construction HGVs creates dangerous mix. No adjacent economic zone or IDA estate justifying infrastructure. Roads not designed for years of heavy construction traffic.',
        'Lack of public engagement': 'No public meeting despite numerous requests. Only 342 houses within 1.5km targeted - many never received correspondence. Consultation letters sent August bank holiday weekend - appointments only Tues/Fri 11am-6pm (workdays). 62 face-to-face meetings total - tiny fraction of affected community. One-to-one consultations lack transparency/accountability. Maps/website only published AFTER consultations ended. Orsted declined all requests for public meeting or media debate.',
        'Decommissioning': 'Ireland lacks large-scale PV recycling facilities - materials exported or landfilled. Panels contain hazardous materials (lead, cadmium). Soil compaction from heavy machinery permanently damages agricultural use. 800+ acres of vegetation cleared - biodiversity loss, erosion risk. No clear financial guarantee (bond/escrow) for 40-year cleanup. Potential leaching of transformer fluids and broken panel materials into soil/water.',
        'Archaeology': '15+ recorded monuments within 5km including: CO056-004 Lime kiln, CO056-002 Ringfort-rath, WA037-009 Earthwork, CO067-001003 Souterrain, CO056-001001 Ancient graveyard. National plan: Archaeological sites = "critical objection grounds". High heritage value - Rath Fort offers protected panoramic historic view. Development contradicts heritage protection requirements.',
        'Flora and fauna (horticulture)': '2+ million sq meters of panels = massive habitat destruction. Construction disrupts breeding, foraging, and shelter for 12+ months. BBC study: Animals displaced during construction do not return. Fencing fragments 1000 acres - blocks wildlife corridors. Mammal access points (30cm x 30cm) too small for deer and large animals. Protected birds: Barn owl, cuckoo, swallow, yellowhammer. Protected fish in Tourig River SAC: Brown trout, sea trout, salmon, eels, lamprey species.',
        'Privacy': 'Elevated site overlooks 342+ homes. Security cameras around entire perimeter - Carlow project cameras pointed into neighboring properties. Survey personnel caught using binoculars watching children playing - reported to Gardaí. Zero screening possible on elevated site. 40 years of surveillance infrastructure overlooking private homes and gardens.',
        'Visual impact': '800+ acres visible from 30+ townlands including: Barnaviddane, Knocknagappagh, Ballydaniel, Ballyneague, Youghalpark, Cornaveigh, Castlemiles, and many more. Elevated site = impossible to screen. Spectacular rural views permanently lost. Beside busy Youghal-Tallow road (R634) - industrial blight on scenic route. 842m from impressive Rath Fort - tourism impact.',
        'Economic knock-on/loss of jobs': 'Loss of 1,300 cows = 9.75 million litres milk lost annually for Dairygold processing. Supporting businesses: Vets, feed suppliers, farm equipment, transport, dairy processing - all lose revenue. Solar provides ZERO local employment after construction. No economic advantage to area. Local businesses that depend on agricultural economy will suffer.',
        'Battery Storage fire risk': '50 containers of Lithium-ion batteries proposed. 342 households within 1.5km + 2 schools nearby. NO Irish regulations for BESS. NO insurance available in Ireland for BESS. Gases (hydrogen fluoride, carbon monoxide, hydrocarbons) are odorless, colorless - severe respiratory danger. Site on "Cronin\'s Bogs" (springs) - direct line to Tourig River (Youghal drinking water). Xerotech Clare fire (Jan 2025): 1,700 students evacuated, 5 firefighters hospitalized, months of contamination, €20-80M cleanup cost. Fire brigades let chemical fires burn - toxic smoke, evacuations ordered. Kildare & Cork councils refused BESS on health/safety grounds.',
        'Devaluation of property': 'SEAI 2016 report outdated (based on 25-acre farms, not 800+ acres). Multiple peer-reviewed studies show 5-20% property value loss within 0.8-1.6km. Virginia Tech, Lawrence Berkeley Lab, URI, Wisconsin studies document decline. Mortgage of €400k could lose €6,000-€20,000 in value. 2023 study: 5.4% price reduction for properties 750m south of >5MW solar farm. Higher losses during construction phase. 3 houses + 1 site already for sale since announcement (unusual for area).',
        'Loss of agricultural land': 'Prime Grade 1-2 agricultural land proposed. 6 townlands affected: Barnaviddane (125 of 250 acres lost), Knocknagappagh, Ballyneague, Ballydaniel, Youghalpark, Cornaveigh. Greenhills = 2-3% of Ireland\'s entire 8GW solar target in ONE location (hugely disproportionate). 61,000 townlands in Ireland - just 6 provide 2% of national renewable target. UK requires poorer quality land be used first - Grade 1-2 protected. France limits agricultural land solar to <10% production loss, <40% coverage. IFA: Solar should use low-grade land, not productive farmland.',
        'Security': 'Isolated utility-scale power generation = obvious security target (road/air access). Larger geopolitical concerns (Russian interest in EU energy infrastructure). Physical threats: Sabotage, explosion. Digital threats: System hacking, management compromise. No police, emergency services, or security personnel nearby. No physical or digital security risk assessment in collateral. CCTV and high fencing inappropriate for rural setting - impacts wildlife movement. Ukraine war lesson: Centralized grid vulnerable - decentralized generation more secure.',
        'Quality of electrical and mechanical components': 'NO legislation governing utility-scale solar quality (unlike homes/businesses). NSAI offers advice only - not enforceable. Developer has commercial interest in cost savings - may procure cheaper components. Exclusive supplier agreements limit access to quality materials. No bonding scheme to ensure quality work. No state inspection/enforcement agency. Laois/Carlow developments show this developer has poor compliance record. Solar industry recommends developments >5MW (25 acres) are "very risky" - this is 250MW (1000+ acres). 220kV substation for 1000MW transmission has no quality safeguards.',
        'Industrialisation': 'Planning Act 2000: Land must be zoned for intended industrial use BEFORE development. Currently zoned agricultural + limited rural homes - NOT industrial. Re-zoning requires: Environmental Impact Assessment, Habitats Directive compliance, hazardous material safeguards (batteries), pollutant assessments (water), transport impact studies. 300+ homes granted planning without industrial zone warnings. Cork County Council has NOT designated this as decarbonization zone. High elevation makes site unsuitable for industrial use (should be flat). No indication of economic zone development or road upgrades.',
        'Air traffic': 'Irish Coast Guard flight path crosses site several times weekly. Solar glare causes temporary vision impairment for pilots (especially low sun). Large installations cause radar reflections - interfere with navigation/tracking. Reflections during critical approach phases create safety hazard.',
        'Existing Renewable applications/developments in Cork/West Waterford': 'Cork already has 3,553 acres established/approved for solar. Additional 941 acres in planning (excluding this project). Government target: 26,000 acres by 2030 ÷ 26 counties = Cork taking 3x fair share already. Nearby projects: Lyranacarriga wind (17 turbines, 1,811 acres, 1.4km away, 46k homes), Inis Ealga marine (70 turbines, 6.3km away, 860k homes), Lysaghtstown solar (378 acres, 22km away, 30k homes). These 3 projects alone support 50% of Irish homes! East Cork has MORE than taken fair share of burden.',
        'Adjacent Renewable applications/development in local area': 'Cumulative visual and environmental impact NOT assessed. Concentration of massive renewable projects in small area. National plan advises AGAINST fragmenting agricultural lands. Solar industry recommends spreading projects equitably - NOT concentrating. Combined impact on wildlife corridors, flooding, traffic, visual amenity not studied. Council has not signposted this concentration as concern.'
      };
      
      selectedLabels.forEach(label => {
        if (factsMap[label]) {
          context += `\n${label}: ${factsMap[label]}`;
        }
      });
      
      return context;
    };
    
    const committeeContext = buildSelectedContext(selectedConcernLabels, concerns);
    
    // Build a concise concerns summary
    let concernsList = '';
    
    // Add detailed responses ONLY for selected concerns
    if (selectedConcernLabels.length > 0) {
      const concernKeyMap = {
        'Food Security': 'food_security',
        'River Pollution': 'river_pollution',
        'Well contamination': 'well_contamination',
        'Flooding': 'flooding',
        'Mental health': 'mental_health',
        'Glint and glare': 'glint_glare',
        'Location, Scale and size': 'location_scale',
        'Noise & vibration': 'noise_vibration',
        'No clear rational plan': 'no_plan',
        'Lack of legislation': 'lack_legislation',
        'Wildlife/Biodiversity': 'wildlife',
        'Impact on children': 'children',
        'Road Safety/Traffic during construction': 'road_safety',
        'Road infrastructure': 'road_infrastructure',
        'Lack of public engagement': 'lack_engagement',
        'Decommissioning': 'decommissioning',
        'Archaeology': 'archaeology',
        'Flora and fauna (horticulture)': 'flora_fauna',
        'Privacy': 'privacy',
        'Visual impact': 'visual_impact',
        'Economic knock-on/loss of jobs': 'economic_impact',
        'Battery Storage fire risk': 'battery_fire',
        'Devaluation of property': 'property_devaluation',
        'Loss of agricultural land': 'agricultural_land',
        'Security': 'security',
        'Quality of electrical and mechanical components': 'quality_components',
        'Industrialisation': 'industrialisation',
        'Air traffic': 'air_traffic',
        'Existing Renewable applications/developments in Cork/West Waterford': 'existing_renewables',
        'Adjacent Renewable applications/development in local area': 'adjacent_renewables'
      };
      
      selectedConcernLabels.forEach(label => {
        const key = concernKeyMap[label];
        if (key && concerns[key]) {
          concernsList += `${label}: ${concerns[key]}\n\n`;
        }
      });
    }
    
    // Add most important, additional, and personal story
    if (concerns.most_important) {
      concernsList += `PRIORITY: ${concerns.most_important}\n\n`;
    }
    if (concerns.additional_concerns) {
      concernsList += `ADDITIONAL: ${concerns.additional_concerns}\n\n`;
    }
    if (concerns.personal_story) {
      concernsList += `PERSONAL: ${concerns.personal_story}`;
    }
    
    // Generate random letter format variation
    const formatStyles = [
      'numbered sections with bold headings',
      'titled sections without numbers',
      'lettered sections (a, b, c) with underlined headings',
      'Roman numeral sections (I, II, III) with capitalized headings',
      'bullet-pointed main concerns with paragraph elaboration'
    ];
    const randomFormat = formatStyles[Math.floor(Math.random() * formatStyles.length)];
    
    // Generate today's date in proper format
    const today = new Date();
    const day = today.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[today.getMonth()];
    const year = today.getFullYear();
    
    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinal = (n) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const formattedDate = `${getOrdinal(day)} ${month} ${year}`;
    
    const prompt = `You are a professional planning consultant helping an individual resident draft a formal objection letter to Cork County Council. 

CLIENT INFORMATION:
Name: ${firstName} ${lastName}${occupation ? `, ${occupation}` : ''}
Property Location: ${distance} from proposed development site

PLANNING APPLICATION DETAILS:
Reference: 25/6876
Applicant: Orsted Onshore Ireland Midco Ltd
Proposal: 328.28 hectare (800+ acre) Solar Farm
Location: Knocknagappagh, Barnaviddane, Ballyneague, Ballydaniel, Youghalpark, Ballydaheen and Cornaveigh, Co. Cork

CLIENT'S CONCERNS (in their own words):
${concernsList}

RELEVANT PLANNING LAW & FACTUAL BACKGROUND:
${committeeContext}

YOUR TASK:
Draft a formal, professional planning objection letter that:
1. Presents the client's concerns in proper planning language
2. References relevant Irish planning guidelines and regulations
3. Uses appropriate legal terminology
4. Maintains a professional, respectful tone
5. Is approximately ${minWords}-${maxWords} words
6. Uses ${randomFormat} for the main objection points

Write the letter using standard planning objection format. Start with today's date (${formattedDate}), then proper letterhead addressing Cork County Council, then the objection itself. 

Focus on the client's specific concerns about: ${selectedConcernLabels.join(', ')}

${distance && !distance.includes('5km+') ? `NOTE: This client lives ${distance} from the site - proximity impacts should be emphasized appropriately.` : ''}

Format requirements:
- Plain text only (no HTML)
- Formal business letter style
- Reference planning application 25/6876
- Site is 328.28 hectares (always state as "800+ acres" or "over 800 acres")
- Conclude with "Mise le Meas" and client's name

Begin the letter now:`;

    console.log('Calling Claude API...');
    
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    const claudeResponse = await makeRequest(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        }
      },
      JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096, // Increased to handle up to ~3000 word letters without truncation
        messages: [{ role: 'user', content: prompt }]
      })
    );
    
    const generatedLetter = claudeResponse.content[0].text;
    console.log('Letter generated (' + generatedLetter.length + ' chars)');
    
    // Clean up any HTML tags and fix character encoding issues
    const cleanedLetter = generatedLetter
      .replace(/<\/?u>/gi, '')  // Remove <u> and </u> tags
      .replace(/<\/?b>/gi, '')  // Remove <b> and </b> tags
      .replace(/<\/?i>/gi, '')  // Remove <i> and </i> tags
      .replace(/<\/?em>/gi, '') // Remove <em> and </em> tags
      .replace(/<\/?strong>/gi, '') // Remove <strong> and </strong> tags
      // Fix common UTF-8 encoding issues (using hex codes to avoid syntax errors)
      .replace(/\u00e2\u0080\u0093/g, '-')  // Fix en dash
      .replace(/\u00e2\u0080\u0094/g, '-')  // Fix em dash
      .replace(/\u00e2\u0080\u0098/g, "'")  // Fix left single quote
      .replace(/\u00e2\u0080\u0099/g, "'")  // Fix right single quote
      .replace(/\u00e2\u0080\u009c/g, '"')  // Fix left double quote
      .replace(/\u00e2\u0080\u009d/g, '"')  // Fix right double quote
      .replace(/\u00c3\u00a1/g, 'a')        // Fix á
      .replace(/\u00c3\u00a9/g, 'e')        // Fix é
      .replace(/\u00c3\u00ad/g, 'i')        // Fix í
      .replace(/\u00c3\u00b3/g, 'o')        // Fix ó
      .replace(/\u00c3\u00ba/g, 'u')        // Fix ú
      // Also handle properly encoded unicode characters
      .replace(/[\u2013\u2014]/g, '-')      // Convert en dash and em dash to simple dash
      .replace(/[\u2018\u2019]/g, "'")      // Convert smart single quotes to straight
      .replace(/[\u201c\u201d]/g, '"');     // Convert smart double quotes to straight
    
    // PREPEND the formatted address to the letter
    // This way Claude never sees the full address and can't refuse
    const letterWithAddress = letterAddress + '\n\n' + cleanedLetter;
    console.log('Address prepended to letter');
    
    // Create filenames with DD-MM-YYYY-HH-MM format
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${dd}-${mm}-${yyyy}`;
    const timeStr = `${hh}-${min}`;
    const nameSafe = `${firstName}${lastName}`.replace(/[^a-zA-Z]/g, '');
    
    const inputsFilename = `Inputs-${nameSafe}-${dateStr}-${timeStr}.txt`;
    const letterFilename = `Letter-${nameSafe}-${dateStr}-${timeStr}.txt`;
    
    // Generate text files
    console.log('Creating formatted text files...');
    const inputsContent = createInputsTextFile(formData, firstName, lastName, selectedConcernLabels);
    const letterContent = createLetterTextFile(letterWithAddress, firstName, lastName);
    
    // Upload to Dropbox
    console.log('Uploading to Dropbox...');
    // Create UNIQUE subfolder name from person's name + date + time (sanitized)
    // This ensures no duplicates even if same person submits multiple times
    const subfolderName = `${firstName}${lastName}-${dateStr}-${timeStr}`.replace(/[^a-zA-Z0-9-]/g, '');
    const dropboxInputs = await uploadToDropbox(inputsContent, inputsFilename, subfolderName);
    // Note: We don't upload the .txt version of the letter, only the .doc
    
    // Create RTF (Rich Text Format) file - opens perfectly in Word
    // RTF is simpler than DOCX and works everywhere
    const letterDocFilename = letterFilename.replace('.txt', '.doc');
    
    // Convert letter to RTF format with proper letter formatting
    function createRTF(text, firstName, lastName, formattedAddress) {
      // RTF header
      let rtf = '{\\rtf1\\ansi\\deff0\n';
      rtf += '{\\fonttbl{\\f0\\fnil\\fcharset0 Times New Roman;}}\n';
      rtf += '\\viewkind4\\uc1\\pard\\lang2057\\f0\\fs22\n\n';
      
      // Parse the letter to extract body (skip the pre-pended address)
      const lines = text.split('\n');
      let restOfLetter = [];
      let foundDate = false;
      
      // Find where the date line starts (this is where the letter body begins)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this is the date line (contains "January", "February", etc.)
        if (/\d+(st|nd|rd|th)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/.test(line)) {
          foundDate = true;
          restOfLetter = lines.slice(i); // Everything from date onwards
          break;
        }
      }
      
      // If no date found, something is wrong - use original formatting
      if (!foundDate) {
        for (const line of lines) {
          if (line.trim() === '') {
            rtf += '\\par\n';
          } else {
            let escaped = line
              .replace(/\\/g, '\\\\')
              .replace(/\{/g, '\\{')
              .replace(/\}/g, '\\}');
            rtf += escaped + '\\par\n';
          }
        }
        rtf += '}\n';
        return rtf;
      }
      
      // Format address on the right with name first
      // Right-aligned address
      rtf += '\\qr\n'; // Right align
      
      // Add name first
      const fullName = firstName + ' ' + lastName;
      rtf += fullName.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}') + '\\par\n';
      
      // Parse full address and add each line
      // Split by newlines and commas first
      let addressParts = formattedAddress.split(/[\n,]/).map(s => s.trim()).filter(s => s);
      
      // If we only got 1 part (no newlines or commas), split it into logical parts
      if (addressParts.length === 1 && addressParts[0].length > 15) {
        const address = addressParts[0];
        const words = address.split(/\s+/);
        
        // Split intelligently - 2 words per line for cleaner formatting
        const lines = [];
        for (let i = 0; i < words.length; i += 2) {
          const chunk = words.slice(i, i + 2).join(' ');
          if (chunk) lines.push(chunk);
        }
        addressParts = lines;
      }
      
      // Add each address part as a separate line
      for (const part of addressParts) {
        const escaped = part
          .replace(/\\/g, '\\\\')
          .replace(/\{/g, '\\{')
          .replace(/\}/g, '\\}');
        rtf += escaped + '\\par\n';
      }
      rtf += '\\par\\par\n'; // Extra spacing after address
      
      // Back to left align for rest of letter
      rtf += '\\ql\n'; // Left align
      
      // Process rest of letter
      for (const line of restOfLetter) {
        if (line.trim() === '') {
          rtf += '\\par\n';
        } else {
          // Escape special RTF characters
          let escaped = line
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}');
          
          // Make "Re:" line bold
          if (escaped.startsWith('Re:')) {
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          }
          // Make section headings bold
          else if (/^(\d+\.|[A-Z]\)|\*\*|I+\.|[a-z]\))/.test(escaped) || escaped.includes('**')) {
            escaped = escaped.replace(/\*\*/g, '');
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          } 
          // Make signature bold
          else if (escaped === 'Mise le Meas,' || escaped === firstName + ' ' + lastName) {
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          }
          else {
            rtf += escaped + '\\par\n';
          }
        }
      }
      
      rtf += '}\n';
      return rtf;
    }
    
    const letterRTF = createRTF(letterContent, firstName, lastName, letterAddress);
    
    // Upload DOC to Dropbox
    const dropboxDoc = await uploadToDropbox(letterRTF, letterDocFilename, subfolderName);
    console.log('DOC file uploaded to Dropbox:', dropboxDoc);
    
    const attachments = [
      {
        content: Buffer.from(letterRTF).toString('base64'),
        filename: letterDocFilename,
        type: 'application/msword',
        disposition: 'attachment'
      },
      {
        content: Buffer.from(inputsContent).toString('base64'),
        filename: inputsFilename,
        type: 'text/plain',
        disposition: 'attachment'
      }
    ];
    
    // Build input summary for email
    const inputSummary = Object.entries(concerns)
      .filter(([key, value]) => value && value.length > 0)
      .map(([key, value]) => `<strong>${key.replace(/_/g, ' ').toUpperCase()}:</strong><br>${value}`)
      .join('<br><br>');
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .section { background: #f9f9f9; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .letter-box { background: #fff; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .instructions { background: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; }
    .attachments { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <h2>Your Personalized Objection Letter</h2>
  
  <p>Dear ${firstName},</p>
  
  <p>Thank you for using the Greenhills Renewable Energy Development Objection Generator created by the <strong>Inch Killeagh Rural Preservation Group</strong>.</p>
  
  <div class="attachments">
    <h3>📎 ATTACHED FILES:</h3>
    <p><strong>${letterDocFilename}</strong> - Your objection letter (Word format - ready to submit)</p>
    <p><strong>${inputsFilename}</strong> - Your form inputs (text file - for your reference)</p>
    <p>Both files have also been saved to our shared Dropbox folder for committee records.</p>
  </div>
  
  <div class="letter-box">
    <h3>📄 YOUR GENERATED OBJECTION LETTER:</h3>
    <pre>${letterContent}</pre>
  </div>
  
  <div class="instructions">
    <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
      <h4 style="margin-top: 0; color: #856404;">⚠️ IMPORTANT DISCLAIMER</h4>
      <p style="margin-bottom: 0; color: #856404;">
        <strong>This letter is a suggested template to assist you in creating your planning objection.</strong> 
        It is your responsibility to review, verify, and ensure the content accurately reflects your individual 
        concerns, feelings, and personal circumstances. Please edit as needed before submission.
      </p>
    </div>
    
    <h3>📋 HOW TO SUBMIT YOUR OBJECTION:</h3>
    <ol>
      <li><strong>Open the attached Word document</strong> (.doc file)</li>
      <li><strong>Review and edit as needed:</strong>
        <ul>
          <li>Personalize any sections you wish</li>
          <li>Add photos, maps, or evidence images that support your concerns</li>
          <li>Adjust wording to match your voice</li>
          <li><strong>Verify all facts and statements match your personal situation</strong></li>
        </ul>
      </li>
      <li><strong>Submit online</strong> at: <a href="https://www.corkcoco.ie">www.corkcoco.ie</a>
        <ul>
          <li>€20 submission fee required</li>
          <li>Include planning reference: <strong>25/6876</strong></li>
          <li><strong>Closing date for objections is Tuesday 3rd February 2026</strong></li>
        </ul>
      </li>
      <li><strong>Need help?</strong> Read Cork County Council's submission guidelines: <a href="https://www.corkcoco.ie/sites/default/files/2022-01/access-guidelines-for-making-a-submission-on-a-planning-application-pdf.pdf">View Guidelines (PDF)</a></li>
    </ol>
  </div>
  
  <p><em>In solidarity,<br>Inch Killeagh Rural Preservation Group</em></p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666;">
    <p>Inch Killeagh Rural Preservation Group | County Cork, Ireland<br>
    Email: inchsolaraction@gmail.com</p>
    <p style="font-size: 11px;">This email was sent regarding your submission to the Greenhills Renewable Energy Development objection service.</p>
  </div>
</body>
</html>`;
    
    // Create better plain text version
    const emailBodyText = `
INCH KILLEAGH RURAL PRESERVATION GROUP
Planning Objection Service

Dear ${firstName},

Thank you for using our planning objection service for the proposed Greenhills Renewable Energy Development.

Your personalized planning submission has been prepared based on your concerns.

ATTACHED FILES:
- ${letterDocFilename} (Your objection letter - Word/DOC format, ready to submit)
- ${inputsFilename} (Your form inputs - text file, for your reference)

⚠️ IMPORTANT DISCLAIMER:
This letter is a suggested template to assist you in creating your planning objection.
It is your responsibility to review, verify, and ensure the content accurately reflects 
your individual concerns, feelings, and personal circumstances. Please edit as needed 
before submission.

HOW TO SUBMIT YOUR OBJECTION:

1. Open the attached Word document (.doc file)
2. Review and edit as needed:
   - Personalize any sections
   - Add photos, maps, or evidence images
   - Adjust wording to match your voice
   - Verify all facts and statements match your personal situation
3. Save as PDF (File → Save As → PDF)
4. Submit online at: www.corkcoco.ie
   - €20 submission fee required
   - Planning Reference: 25/6876
   - Closing date: Tuesday 3rd February 2026

NEED HELP?
Read Cork County Council's submission guidelines:
https://www.corkcoco.ie/sites/default/files/2022-01/access-guidelines-for-making-a-submission-on-a-planning-application-pdf.pdf

TO ENSURE YOU RECEIVE FUTURE UPDATES:
1. Move this email to your inbox if it's in spam/promotions
2. Mark as "Not Spam"
3. Add inchsolaraction@gmail.com to your contacts

In solidarity,
Inch Killeagh Rural Preservation Group
`;
    
    // Send email
    console.log('Sending email to:', email);
    const emailResult = await sendEmailViaSendGrid(
      email,
      `Your Planning Objection - Ref: ${firstName.substring(0,1)}${lastName.substring(0,3)}${dateStr}`,
      emailBodyHtml,
      emailBodyText,
      attachments
    );
    
    return res.status(200).json({
      success: true,
      message: 'Letter generated, emailed, and saved',
      letter_length: cleanedLetter.length,
      email_status: emailResult,
      dropbox_status: { inputs: dropboxInputs, doc: dropboxDoc },
      files: { inputs: inputsFilename, doc: letterDocFilename },
      version: '3.0-v10'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to generate letter',
      message: error.message
    });
  }
};
