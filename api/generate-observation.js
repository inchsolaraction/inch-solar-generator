// Greenhills 220kV Substation - Observation Generator V1
// Copy of the solar objection generator (V35) adapted for ACP case VA04.324632
// Deploy as api/generate-observation.js. Solar endpoint (api/generate-letter.js) is unchanged.
// Concern options are read from the Tally payload itself (option ids -> option text), so no UUID map is needed.
// Env vars: reuses all existing ones. Optional: GOOGLE_DRIVE_FOLDER_ID_SUBSTATION (falls back to GOOGLE_DRIVE_FOLDER_ID).

const https = require('https');
const redis = require('redis');

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

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
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

function cleanText(text) {
  if (!text) return '';
  return String(text).replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ').replace(/"/g, "'").replace(/\\/g, '').trim();
}

function formatAddress(fullAddress) {
  if (!fullAddress) return '';
  let cleaned = fullAddress.replace(/\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/gi, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/,\s*$/g, '').replace(/^\s*,\s*/, '').trim();
  return cleaned;
}

function findFormField(formData, possibleNames) {
  for (const name of possibleNames) {
    if (formData[name]) return formData[name];
  }
  const keys = Object.keys(formData);
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const matchingKey = keys.find(key => key.toLowerCase().includes(lowerName));
    if (matchingKey && formData[matchingKey]) return formData[matchingKey];
  }
  return '';
}


function createInputsTextFile(formData, firstName, lastName, selectedConcernLabels) {
  const now = new Date();
  let content = `Respondent: ${firstName} ${lastName}\nGenerated: ${now.toISOString()}\n\n`;
  content += `Selected topics: ${(selectedConcernLabels || []).join(', ')}\n\n${'='.repeat(60)}\nFORM ANSWERS\n${'='.repeat(60)}\n\n`;
  const seen = new Set();
  Object.keys(formData).forEach(k => {
    const v = formData[k];
    if (/^question_/.test(k)) return;
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) return;
    const s = String(v);
    const sig = k + '|' + s;
    if (seen.has(sig)) return;
    seen.add(sig);
    content += `${k.trim()}:\n${s}\n\n`;
  });
  return content;
}

function createLetterTextFile(letterText) {
  return letterText;
}

let cachedAccessToken = null;
let tokenExpiry = 0;
async function getDropboxAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry) return cachedAccessToken;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!refreshToken || !appKey || !appSecret) {
    console.error('Missing Dropbox credentials. Need: DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET');
    throw new Error('Dropbox not configured');
  }
  console.log('Refreshing Dropbox access token...');
  const credentials = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  const tokenResponse = await makeRequest(
    { hostname: 'api.dropbox.com', path: '/oauth2/token', method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } },
    `grant_type=refresh_token&refresh_token=${refreshToken}`
  );
  if (tokenResponse.access_token) {
    cachedAccessToken = tokenResponse.access_token;
    tokenExpiry = Date.now() + (3.5 * 60 * 60 * 1000);
    console.log('Dropbox access token refreshed successfully');
    return cachedAccessToken;
  }
  throw new Error('No access token in response');
}

async function uploadToDropbox(content, fileName, subfolder) {
  subfolder = subfolder || '';
  try {
    const accessToken = await getDropboxAccessToken();
    const buffer = Buffer.from(content, 'utf8');
    const basePath = '/Inch Substation Observations';
    const fullPath = subfolder ? `${basePath}/${subfolder}/${fileName}` : `${basePath}/${fileName}`;
    const response = await makeRequest(
      { hostname: 'content.dropboxapi.com', path: '/2/files/upload', method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path: fullPath, mode: 'add', autorename: true, mute: false }) } },
      buffer
    );
    console.log('Uploaded to Dropbox:', fullPath);
    return { success: true, path: response.path_display };
  } catch (error) {
    console.error('Dropbox upload failed:', error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================
// GOOGLE DRIVE (NEW in V33)
// ============================================================
let cachedGoogleAccessToken = null;
let googleTokenExpiry = 0;

async function getGoogleAccessToken() {
  if (cachedGoogleAccessToken && Date.now() < googleTokenExpiry) return cachedGoogleAccessToken;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) {
    console.error('Missing Google credentials. Need: GOOGLE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
    throw new Error('Google Drive not configured');
  }
  console.log('Refreshing Google access token...');
  const postData = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`;
  const tokenResponse = await makeRequest(
    { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } },
    postData
  );
  if (tokenResponse.access_token) {
    cachedGoogleAccessToken = tokenResponse.access_token;
    googleTokenExpiry = Date.now() + (50 * 60 * 1000);
    console.log('Google access token refreshed successfully');
    return cachedGoogleAccessToken;
  }
  throw new Error('No access token in response');
}

async function uploadToGoogleDrive(content, fileName, mimeType) {
  mimeType = mimeType || 'text/plain';
  try {
    const accessToken = await getGoogleAccessToken();
    const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID_SUBSTATION || process.env.GOOGLE_DRIVE_FOLDER_ID);
    if (!folderId) {
      console.error('GOOGLE_DRIVE_FOLDER_ID not configured');
      return { success: false, message: 'Google Drive folder not configured' };
    }
    const boundary = 'inch_solar_boundary_' + Date.now();
    const metadata = { name: fileName, parents: [folderId] };
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const contentPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n`;
    const closingBoundary = `--${boundary}--`;
    const multipartBody = metadataPart + contentPart + closingBoundary;
    const bodyBuffer = Buffer.from(multipartBody, 'utf8');
    const response = await makeRequest(
      { hostname: 'www.googleapis.com', path: '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': bodyBuffer.length } },
      bodyBuffer
    );
    console.log('Uploaded to Google Drive:', fileName, '- File ID:', response.id);
    return { success: true, fileId: response.id, name: fileName };
  } catch (error) {
    console.error('Google Drive upload failed:', error.message);
    return { success: false, message: error.message };
  }
}

async function sendEmailViaSendGrid(to, subject, htmlBody, textBody, attachments) {
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (!sendGridKey) {
    console.log('SENDGRID_API_KEY not configured');
    return { success: false, message: 'SendGrid not configured' };
  }
  try {
    const emailData = {
      personalizations: [{ to: [{ email: to }], bcc: [{ email: 'inchsolaraction@gmail.com' }], subject: subject }],
      from: { email: 'noreply@greenhillssolarobjection.com', name: 'Inch Killeagh Rural Preservation Group' },
      reply_to: { email: 'inchsolaraction@gmail.com', name: 'Inch Killeagh Rural Preservation Group' },
      headers: { 'X-Priority': '3', 'X-Entity-Ref-ID': 'inch-solar-objection' },
      categories: ['planning-objection', 'community-service'],
      content: [{ type: 'text/plain', value: textBody }, { type: 'text/html', value: htmlBody }],
      attachments: attachments || []
    };
    await makeRequest(
      { hostname: 'api.sendgrid.com', path: '/v3/mail/send', method: 'POST',
        headers: { 'Authorization': `Bearer ${sendGridKey}`, 'Content-Type': 'application/json' } },
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

    client = await getRedisClient();

    const webhookData = req.body.data || req.body;

    const tallySubmissionId = webhookData.submissionId || webhookData.responseId || webhookData.id;

    if (tallySubmissionId) {
      const redisKey = `submission:${tallySubmissionId}`;
      const alreadyProcessed = await client.get(redisKey);

      if (alreadyProcessed) {
        console.log('DUPLICATE DETECTED - Tally re-sent submission:', tallySubmissionId);
        return res.status(200).json({
          message: 'Duplicate submission already processed',
          submissionId: tallySubmissionId,
          originalProcessedAt: parseInt(alreadyProcessed),
          status: 'ignored'
        });
      }

      await client.set(redisKey, Date.now().toString(), { EX: 604800 });
      console.log('Processing new submission:', tallySubmissionId);
    }

    const fields = webhookData.fields || [];

    const formData = {};
    const optionMap = {};
    fields.forEach(field => {
      if (Array.isArray(field.options)) field.options.forEach(o => { if (o && o.id) optionMap[o.id] = o.text; });
      if (field.key && field.value !== undefined) {
        formData[field.key] = field.value;
        if (field.label) formData[field.label] = field.value;
      }
    });

    fields.forEach(field => {
      if (Array.isArray(field.value) && field.options) {
        const txt = field.value.map(v => optionMap[v] || v).join(', ');
        if (field.key) formData[field.key] = txt;
        if (field.label) formData[field.label] = txt;
      }
    });

    console.log('Form field keys:', Object.keys(formData).join(', '));

    let email = String(formData['Email'] || '').trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('Invalid email:', email);
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const firstName = cleanText(formData['First Name'] || '');
    const lastName = cleanText(formData['Last name'] || '');

    const quickCheckKey = `quick:${email}-${firstName}-${lastName}`;
    const recentSubmission = await client.get(quickCheckKey);

    if (recentSubmission) {
      const timeSince = Date.now() - parseInt(recentSubmission);
      if (timeSince < 5 * 60 * 1000) {
        console.log('DUPLICATE DETECTED - Same person submitted within 5 minutes');
        return res.status(200).json({
          message: 'Duplicate submission - same person within 5 minutes',
          timeSinceLastSubmission: timeSince,
          status: 'ignored'
        });
      }
    }

    await client.set(quickCheckKey, Date.now().toString(), { EX: 600 });

    if (!tallySubmissionId) {
      const backupKey = `backup:${email}-${firstName}-${lastName}-${Date.now()}`;
      await client.set(backupKey, Date.now().toString(), { EX: 604800 });
      console.log('No Tally submission ID - using backup tracking');
    }

    console.log('Processing form submission...');


    const TOPIC_KEYS = {
 "archaeolog": "Archaeology",
 "noise": "Noise and Vibration",
 "hydrolog": "Hydrology and Flooding",
 "flood": "Hydrology and Flooding",
 "site location": "Site Location",
 "location": "Site Location",
 "visual": "Visual",
 "water pollution": "Water pollution",
 "pollution": "Water pollution",
 "emergency": "Emergency risk",
 "fire": "Emergency risk",
 "regulat": "lack of regulation",
 "legislat": "lack of regulation",
 "consult": "Lack of public consultation",
 "engagement": "Lack of public consultation",
 "cumulative": "Cumulative effect"
};
    const TOPIC_FACTS = {
 "Archaeology": "This observation is confined to the works in this application: the 220 kV compound, the loop-in towers, and the access shown in red on drawing 300101185-DR-100B. The avoidance measures are written for a solar farm, not for this compound Appendix R, the Archaeology and Cultural Heritage Impact Assessment, is an assessment of the wider renewable-energy site. The measures it uses to avoid buried archaeology are solar measures. The executive summary says the four anomalies found by the survey ( M1 to M4 in the geophysical survey, Appendix I of Appendix R in fields 22, 58, 63 and 66) are to be preserved by non-intrusive gabion or ballasted foundations and stand-off buffers, so that excavation is avoided. The mitigation list on page 3 of that report repeats this: preservation in situ by non-intrusive foundation systems, and a conclusion that residual effects will be neutral, imperceptible or not significant. Those measures do not apply to this application. Drawing 300101185-DR-213, Cut and Fill Details - Substation Compound (A-A and B-B), shows the compound being formed by cut and fill. The Cut/Fill Summary on that drawing shows a cut of 17,304 cubic metres and a fill of 34,669 cubic metres. The sections show a finished compound level of 109.05 m, cut into rising ground. A platform of that kind cannot sit on gabion baskets. The report's reliance on decommissioning, and on the development being reversible, is also a solar point. This compound is a permanent 220 kV station. The survey is not shown to cover the compound A walkover of the wider site was carried out on 14-16 May 2025. Paragraph 5.3 of Appendix R says nothing previously unknown was seen inside the site boundary. The compound is inside that boundary, so the walkover included it. A walkover sees only the surface. It does not show what is under a platform that is to be cut. The sub-surface survey is the geophysical survey under licence 26R0042, reported in Appendix I of Appendix R. Paragraph 3.15 says it covered a significant portion of the site, not all of it. Fields in the south-western portion were left out because of rough ground. The survey report also identifies overhead lines, tracks, yards and streams as constraints. The applicant does not state that the compound, the tower bases or the sections of access to be widened were inside the surveyed area. Watching the excavator is too late for this platform Paragraph 6.34 of Appendix R says the substation, the compound areas and the access tracks should be subject to archaeological monitoring during construction. Paragraph 6.35 says that if something is found, work will stop, and preservation in situ will be preferred \"where feasible\". On a platform that has already been approved, and that has to be cut to a finished level, preservation in situ will not be feasible. The usual result of a monitoring condition is to record what the excavator has found and then build. This is the opposite of the standard the same applicant has already been held to. Paragraph 3.14 of Appendix R quotes Cork County Council's comments of 10 February 2026 on the solar application. The Council said that application was not complete because the archaeological assessment was inadequate, and that an assessment of sub-surface archaeology was required so the application could be examined and checked against the County Development Plan. The geophysical survey report, at page 5 of Appendix I, says the Council asked for that assessment at pre-planning stage rather than pre-construction. That letter does not decide this application. The point is that the same developer, on the same lands, has already been told that buried archaeology has to be known before a decision. The piece of the project that involves the cut should not be held to a lower standard than the panels. The hillfort setting is described, and then not assessed Paragraph 4.15 of Appendix R records a hillfort in Rath townland, CO067-001001, 490 m west of the site boundary, and says it occupies a commanding position in the local landscape. Paragraphs 6.4 and 6.5 deal with direct effects on recorded monuments and do not assess this one. The setting assessment that follows is written around protected structures and buildings on the National Inventory of Architectural Heritage, and in places relies on the development being reversible and on hedgerow planting. The report does not contain a specific assessment of the effect of a permanent compound, lightning masts and new towers on the sett",
 "Noise and Vibration": "This section is confined to the 220 kV compound, the loop-in towers where it joins the existing Knockraha-Cullenagh line, and the access shown in red on drawing 300101185-DR-100B, to Site Access No. 1 on the R634. The solar farm and the battery compound are a separate application. They are not used for this one, and they are not used against it. The site notice seeks a permanent per mission for the station and the loop-in, to remain when the solar farm is decommissioned and to be handed to EirGrid. This section treats the station as permanent. It does not treat it as reversible. The figures below are extracts from the application. They are reduced to the part that supports the point. They are not new drawings. The assessment on the file is not an assessment of these works Appendix S is titled for the Greenhills Renewable Energy Park. Section 1.1 says it covers solar-farm construction, open-cut trenching, construction of the substation and the battery compound, and operation of all three. That is the scope of the report. It is not the scope of this application. Table 1.1 gives distance to the energy park red line. The closest figures, 5 m and 8 m, are distances to that boundary. They are not distances to the platform on drawing 300101185-DR-213. The report does not give a distance from the compound, or from this access, to any house. Chapter 15 of the Planning and Environmental Report summarises Appendix S and concludes that residual construction and decommissioning impacts will not occur, and that operational noise is not significant. Section 3.7.6 of the EIA Screening Report says construction noise will be temporary and operational noise is not expected to be significant. There is no EIAR. Those conclusions are conclusions about the energy park. A report written for the solar farm, the battery compound and the station together cannot be treated as the noise and vibration assessment of the permanent station and the access in this file. Construction of this compound and this access The report's own test, at section 1.2.5.1, taken from BS 5228, is a level at or above 65 dB at a house, lasting more than 10 days in any 15, or more than 40 days in any six months. Section 5.5.6.1 puts these works at about 16 months, so the time part of that test is met if the level is met. The level has not been calculated for this platform, this access, or the haul to Site Access No. 1. The 23 to 45 dB column in Table 1.28 is not that calculation. Compliance has not been shown. Drawing 300101185-DR-213 does not give one fill volume. The Cut/Fill Summary gives a cut of 17,304 m3 and a fill of 34,649 m3, a net fill of 17,345 m3, to 109.05 m. The notes on the same drawing give a fill of 36,649 m3, and a further 9,490 m3 of capping stone, not shown on the sections, taking the finished level to 109.45 m. Section 5.5.6.1 of the Planning and Environmental Report gives a third figure for the same platform, 25,013 m3, and says all excavated material will be used for the fill. That sentence cannot be reconciled with the drawing. On either drawing figure the fill exceeds the cut, so that volume of fill has to be imported. The stone is a separate import. It is a 400 mm layer on top of the platform, and it would have to be brought in even if the cut equalled the fill. Section 3.7.5 of the screening report, which says excavated material will be reused, joins the station to the battery compound. The battery compound is not this application. Section 5.5.6.1 puts the substation works at about 16 months, including the access, excavation and levelling, and delivery of the transformers. The access in this application is the red route on drawing 300101185-DR-100B, running north and then east to Site Access No. 1 on the R634. The notes on that drawing, which put an access track into the energy park application, do not remove the access the site notice applies for. Construction traffic for the imported fill, the capping stone and the transformer delivery is traffic of these works, on that access and on the R634. Drawing 300101185-DR-100B. The red line is the access in this application, from the compound north of the existing 220 kV line to Site Access No. 1 on the R634. The L7828 is labelled on the same drawing. It is not that red line. The battery compound and a proposed access track are marked as subject to a separate application. Appendix S does not assess those works. Table 1.3 lists four items for substation works: an excavator, a generator, a vibratory ro",
 "Hydrology and Flooding": "My objection is not based on opposition to renewable-energy infrastructure in principle. Rather, it concerns the appropriateness of locating substantial and permanent high-voltage electrical infrastructure, extensive hardstanding, access roads, drainage infrastructure, transformers and ancillary development on land which, based on direct local observation, is frequently wet and waterlogged and which lies within a wider hydrological system where the applicant itself acknowledges downstream flooding and hydrological connectivity to sensitive receptors. The applicant's own Appendix N - Land, Soils, Geology, Hydrology and Hydrogeology Assessment contains a number of important findings which, in my view, demonstrate that the hydrological implications of this site require especially careful scrutiny before any permission could reasonably be granted. 1. Fundamental suitability of the site The central question is not simply whether an engineered drainage system can be constructed. The more fundamental question is whether this is an appropriate location for permanent electrical infrastructure of this scale having regard to the existing hydrological regime. The proposed development involves the replacement or modification of agricultural land with hardstanding, access tracks, transformer compounds, buildings, drainage infrastructure and a substantial substation platform. Appendix N identifies the 220 kV AIS substation footprint as approximately 1.8 hectares and expressly states that the effect on land occupied by the substation and new and upgraded access tracks will be \"moderate, adverse and permanent.\" It further records excavation depths of up to approximately 3.6 metres at the substation, a combined cut-and-fill volume associated with the substation and BESS of approximately 25,013 m3, and approximately 9,320 m3 of imported stone to cap the substation platform to a depth of 400 mm. Appendix N, Sections 1.4.1.2 and 1.4.1.3, pp.28-29. Appendix N . These are significant physical interventions into the existing soil, drainage and water-retention regime. They should not be characterised as minor alterations to undeveloped land. The applicant should therefore demonstrate, by robust site-specific evidence, that the proposed development will not materially alter existing surface-water flow paths, groundwater movement, infiltration, overland flow, natural storage capacity or the timing and volume of downstream flows. 2. The applicant acknowledges existing downstream flooding The applicant's own assessment confirms that flood risk cannot be considered solely by reference to whether the red-line site itself falls within a mapped flood zone. Appendix N states that the site does not fall within mapped low, medium or high-probability flood zones. However, it also acknowledges that the Tourig_020 and Glendine_010 watercourses adjacent to the site have mapped indicative flooding in present-day low and medium-probability flood zones. Importantly, it further states that \"local knowledge has also indicated that local flooding is occurring within the same river sub-basin of the site.\" Appendix N, Section 1.8.3, Flood Risk, pp.49-51. Appendix N. This is particularly relevant in circumstances where local observations identify seasonally wet or waterlogged ground. The absence of a mapped flood zone directly beneath the proposed substation should therefore not be treated as equivalent to the absence of hydrological risk. The more relevant issue is whether the proposed works could alter runoff, drainage pathways or storage in a manner which worsens flooding elsewhere within the same hydrological system. 3. Applicant's own assessment identifies a measurable increase in runoff The applicant's Flood Risk Assessment calculates that a 1-in-100-year storm event would result in a net increase in surface-water runoff associated with the proposed development of approximately 0.016-0.185 m3/s, representing up to approximately 4.15% relative to the relevant micro-catchment. Appendix N expressly states that construction activities will increase runoff and that, without mitigation, this could lead to flooding either on site or downstream. It further acknowledges that poorly designed drainage could create new preferential drainage pathways, erosion and soil degradation. Appendix N, Section 1.9.1.1, Flood Risk Downstream, pp.60-61. Appendix N. The report goes further and states that, in the absence of mitigation, potential flooding effects could be localised to ",
 "Site Location": "Objective Consideration of alternative sites There is a requirement under Irish law and European directives for applicants of strategic developments to consider alternative locations objectively. Some of the acts and directives to be considered are: Planning and Development Act 2000 (as amended)Large Scale electrical substations (Above 110kV) are classified for Environmental Impact Assessment Report (EIAR) The legal obligation is to provide evidence of comparisons of \"Reasonable Alternatives\"Despite indirectly mentioning the Blackwater SAC as an area of European special protection no other alternatives along the 220kV route seemed to have been assessed. European EIA Directive (2014/52/EU) is transposed into Irish Law via the Planning and Development Regulations 2001 (as amended)This legal advice specifically calls for \"Reasonable Alternatives\" to be studied by the applicant and the supporting documents show no such studies. This would include direct comparisons of each site considered. Contrary to Environmental Protection Agency (EPA) statutory guidelines (Environmental Impact Assessment Reports 2022) The applicant seems to be commercially biased in this application towards this particular location. The evidence of this is No cohesions and single hypothesis for the selection of this site other than landowner permission.The landowner(s) themselves have commercial interests. Multiple sources of studies have very sloppy references to the company name. These opinions seem largely paid for but do not offer comparisons of other locations that might be better strategically suited along the 2002kV route . It is explicitly called out that an applicant cannot base their site location purely on land ownership and amenable landowners based on commercial weight. The applicant has not established a credible list of criteria upon which the decision of this site is clear and empirical. Some of this criteria is advised by the EPA (but not demonstrated in the applicants submission). Examples are: Environmental Constraints (noise, pollution etc..) Whilst some of these are in studies they are not reasonably compared with alternatives. Local residents have demonstrated by lodging submissions to Cork County Council, petitions, and their own public consultations that no reasonable attempt was made at public consultation and alteration of the site. By the applicants own documents they clearly show a huge impact of this site location to over 300 homes.  Alternatives might have shown much less residential impact along the same 220kV route but no alternatives were indicated. The submissions offered by the commission which ought to cover the private consultation with Orsted (the previous incarnation of the applicant's business entity) offer no insight as to the process flow engaged with for alternative assessments during that private consultation. This is also covered under schedule 6 of the planning and development regulations 2001 (enforcing the EU/EIA directive). Hopefully that is not an oversight on behalf of the commission's representatives in those private consultations. No evidence seems to support the subjective comparison as indicated by the legislation (nationally) and directives (EU). The reports and in particular drainage (Appendix B as an example) seem to have had the research conducted in the Summer months during especially dry periods. It is well known that the proposed site suffers from wetland conditions and a realistic study and comparison with alternative sites ought to be conducted during winter or the least favourable time. The appendices relating to road conditions trivialise the impact of the road impact. Many submissions to both Cork County Council applications made it known that road impact was of paramount concern locally. In this particular application (substation on the 220kV route) the road to the proposed substation is totally unfit for heavy goods vehicles. This by itself would have made for multiple criteria evaluation for emergency vehicles in the event of unforeseen issues. No emergency vehicle is equipped to make that journey, especially during peak wetland conditions. Despite correspondence from the commission Eirgird has not offered any third party documents or letters of support for this particular site and location. Any reasonable applicant would seek support from critical stakeholders like Eirgrid (Upstream connectivity on the grid) and ESB networks (downstream consumption). That would lend itself well to",
 "Visual": "The Visual Impact Assessment, LVIA, was prepared by Macro Words Ltd using GLVIA3 methodology with a 5km study area and 24 representative viewpoints. The document mentions nearby homes and acknowledges that residential receptors are highly sensitive. However, it does not adequately demonstrate the visual impact of the proposed 220 kV substation on those homes and this is evident in the photomontages. The LVIA appears to assess the solar farm as the dominant visual element, while treating the Substation as part of the overall development. It does not provide a dedicated residential visual assessment showing what the substation's 2.6 m fencing, buildings, transformers, electrical equipment, lighting and particularly the approximately 18 m lightning-protection masts will look like from the nearest houses. 1.The LVIA itself recognises that residents are particularly sensitive The methodology explicitly states that the visual assessment must consider the reaction of viewers including residents. It also states that primary views from residential properties are an important consideration in residential amenity. The document itself establishes a fairly strong methodological basis for examining the actual views from homes. On page 28, the LVIA says: \"Several residential dwellings are located in the surrounds of the proposed substation building\" It then says that none are immediately adjacent to the substation boundary and that they are set back from the proposed infrastructure. The consultant clearly knows there are residential receptors around the substation. However, the report doesn't then appear to undertake a detailed assessment of those particular houses. 2. The substation is much more visually substantial than the solar panels The actual description of the substation in the LVIA says it includes: approximately 22,631.71 m2 of substation compound; a 438 m2 220 kV control building; a 590 m2 IPP building; two 220 kV transformers; outdoor electrical equipment; a 2.6 m high perimeter fence; lighting on masts; and lightning protection masts approximately 18 m high.  3.4 m above ground. The LVIA itself acknowledges this distinction, saying that the substation and BESS structures are \"slightly larger\" than the PV panels.  But the visual assessment is overwhelmingly structured around the solar panels The assessment contains 24 viewpoints. It discusses residential receptors at a number of them, and some are specifically selected to represent views from or around residential dwellings. For example, VP5 is expressly described as: \"representative of views from local residential dwellings in the immediate surroundings\". The discussion at VP5 is about panels, hedgerows and screening. It isn't a detailed assessment of what residents will see of the substation. Likewise, VP4 discusses a nearby dwelling, but again the discussion concerns the solar panels. The same pattern occurs elsewhere: the LVIA discusses houses as receptors, but the actual visual-effect analysis generally concentrates on the solar array, not the substation and associated structures. 3. An important omission concerning structures The report identifies the 18 m lightning protection masts and 37.5 high lattice support structures, but there is no corresponding residential viewpoint assessment. It says, for example, that the PV panels will not rise more than 3.4 m above the underlying terrain and therefore will be heavily screened by vegetation, buildings and landform. But that reasoning cannot simply be transferred to an 18m/37.5m masts. These structures will potentially rise above hedgerows and tree screening that would conceal a 3.4 m solar panel. That should really be demonstrated with appropriate ZTV analysis/visualisations from the residential receptors concerned. 4. The report relies heavily on future vegetation screening The report proposes substantial planting, including new hedgerows and woodland/thicket planting. It says that this will reduce visibility from surrounding receptors. The report acknowledges that the proposed landscaping has an establishment period. It states that the landscape works will be in an establishment phase for the first three years after planting. For a planning assessment of a large electrical installation beside homes, I would want to know: What can the houses see immediately after construction? What can they see after 3 years? What can they see after 10 years? What happens in winter when deciduous vegetation is bare? Do the 18m/37.5m ",
 "Water pollution": "Various waterways flow through the proposed site those being the Carignass, Knocknappagh, Ballyleague, Ballygarvin and YoughalPark streams, as well as the Tourig and Glendine rivers ultimately flowing into the River Blackwater ( which is a European designated preservation site) and the Celtic Sea. PERIGUS Energy Midco Ireland acknowledges that there is a construction pollution risk and state that pollution prevention measures are required during construction so that run off is not contaminated by fuel,sewage or lubricant spillages. The CEMP also specifically states that the construction programme must address risks to watercourses during each phase of the development proving that water pollution is not being raised externally but by the applicants own environmental management documentation. (CEMP Section 2.4-Proposed Development Programme pg 9) The substation requires major cut-and -fill operations to level the site approx. 13600 cubic metres of  topsoil and 39690 cubic metres of subsoil recontouring 4.71 hectares exposing the whole area to long term rainfall and widespread runoff creating silt and sediment pollution.(CEMP Appendix B Spoil Management Plan pgs 3 / 4) The CEMP describes the site as having an extensive network of historic  drains together with unmapped natural and artificial drainage channels which drain through the River Tourig on into the Blackwater thus creating a pathway for pollution downstream. (CEMP Appendix F pgs 10/11/12 Section 3.2 Site Drainage) The CEMP also acknowledges that there are EPA designated drinking water rivers on site which identify as sensitive receptors under Article 7 concerning abstraction for drinking water. Therefore identifying downstream ecological and water resource receptors. ( CEMP Sections 3.1  and 3.5 pgs 10/15 ) The site is largely underlain by the Glenville Groundwater Body a locally very important Aquifer supplying water to the community as a whole.The CEMP identifies most of the site classified as High Groundwater Vulnerability and close to rivers and to the south of the site even extreme. This is highly relevant as the proposed substation would use drainage methods such as infiltration/ soak away / percolation methods potentially contaminating the water table. The substation itself will also have a surface water drainage percolation infiltration area (5mx5mx1.8m) inside the compound. This requires detailed examination of exactly what water will be permitted to reach the soakaway and  how will water treatment occurs before infiltration. (CEMP 3.3 and 3.4 pgs 14/15) and ( CEMP Section 3.2.2 AIS Substation & BESS pg 13) Transformer oil will explicitly be present as 2 x 33/220kV transformers will be present at the site. The CEMP says that oil and fuel stored at the BESS will be dealt with through the SuDS management train with an interceptor and sokaway. This creates a clear potential pathway should there be a transformer failure or bund storage failure.The Water Quality Monitoring Plan states that despite their proposed mitigation there remains risk of accidental spillages, leaks of contaminants and excessive loading of surface water infrastructure. Once again challenging the applicants own mitigation should an accidental event occur. ( CEMP Appendix C Schedule Of Mitigation Measures Section 11.5.4.4 Operational phase p7) The construction water controls on this project are highly extensive silt fences and ponds,settlement and treatment tanks,buffered outfalls,silt screens, turbidity monitoring,flocculation where necessary, monitoring of suspended solids the list goes on. With regards fuel storage 110% bunded, double skinned fuel bowsers, dip trays, spill kits absorbent pads all  implying that risks are substantial. (CEMP Appendix C Sections 11.5.2-11.5.5 pgs 7-9) The Water Quality Monitoring Plan suggesting that a suitable plan be agreed before construction with Cork County Council and Inland Fisheries Ireland and during construction daily inspections of drainage systems, daily pH testing, continuous monitoring of site run off, monitoring of up/downstream baseline locations and monthly surface water sampling as well as silt trap and drainage channels inspections after construction  all imply the significant dangers to pollution of the environment. (CEMP Appendix E - Water Quality Monitoring Plan Section 3.2 pgs 7-11) Some Unanswered Questions :                                                                                                                 What happe",
 "Emergency risk": "The proposed 220 kV AIS substation will contain high-voltage electrical infrastructure, including up to two 220 kV transformers, electrical switchgear, a diesel generator and fuel tank (Planning and Environmental Report, section 4.3, \"Proposed 220kV AIS Substation\", printed page 57). The site notice describes those transformers as two oil-filled step-down power transformers within bunded enclosures, and includes a diesel generator with fuel tank. Section 5.5.6.1 describes the control-building works as including a bunded diesel tank and generator. Section 4.3 lists the transformers and the diesel generator and tank. It does not use the words \"oil-filled\" or \"bunded\". This is particularly relevant having regard to Schedule 7 of the Planning and Development Regulations 2001, as amended by the European Union (Planning and Development) (Environmental Impact Assessment) Regulations 2018, which specifically requires consideration of \"the risk of major accidents, and/or disasters which are relevant to the project concerned\". The EIA Screening Report applies that criterion at section 3.7.8. That section addresses concrete from inverter and RMU hardstands, hydrocarbon spills from construction plant, and construction-site accidents, and states that no change in the risk of accidents is expected. Table 4.1 rates the risk of major accidents and/or disasters as \"Low - Construction and operation - design to mitigate.\" Neither section 3.7.8 nor section 4.3 assesses a fire at the oil-filled transformers or at the diesel tank. Appendix H, the 220 kV grid-connection outline construction methodology, does not contain that assessment. Section 6.0 of Appendix H is construction access to work areas, crane pads and temporary laydowns. The site notice seeks a permanent permission for the station and the loop-in, to remain when the solar farm is decommissioned and to be handed to EirGrid. Section 6.3 says the station and loop-in will be handed to the network operator and will not be decommissioned. Because the station remains, the application should therefore demonstrate how a fire at the oil-filled transformers or at the diesel tank would be managed, including the oil volume, the bund capacity, and whether firefighting water is retained in the bund. Drawing 300101185-DR-200, the substation layout and drainage, shows a Kingspan Klargester AquaOil full-retention separator, or similar, on the surface-water system, and soakaways. It notes \"Bunds to be fitted with TBC at Detailed Design\". The notes say the drawing is for information, is subject to change, and that TBC means to be confirmed. The oil volume is not stated on the site notice, in section 4.3, or on that drawing. The drawing does not show that a bund will retain the transformer oil together with firefighting water, rather than pass contaminated water through the surface-water system to a soakaway. Rainwater harvesting is shown on the same drawing. It is not described as a firefighting-water supply, and section 4.3 does not describe one. The fitting of the bunds, and the management of a fire at this plant, should be demonstrated on drawing 300101185-DR-200 and in section 4.3 or Appendix H. They should not be left as \"TBC at Detailed Design\". Emergency access. The access this application seeks is the new internal site access road with a site entrance off the R634, described on the site notice, and shown in red on drawing 300101185-DR-100B. It runs north from the compound and then east to Site Access No. 1 on the R634. The note on that drawing states that the battery energy storage system, the access track and the solar park are a separate application. Because the station is to remain after the solar farm is decommissioned, that red route is the access a fire appliance would have to use. The application does not include, in section 4.3, Appendix H, or on drawing 300101185-DR-100B, a fire-appliance swept path from Site Access No. 1 to the transformer bays, a stated gate width, or a turning assessment on that route.  Drawing 300101185-DR-200 shows a concrete access road and a gravel access road within the compound, and ramp accesses to the control building. It does not show that swept path. Drawing 300101185-DR-210 is the gate and fence detail. It is not used to demonstrate that a fire appliance can pass the gate. Appendix M is the Greenhills Energy Park traffic assessment. It is not an assessment of this route.  Section 1.3.3 describes delivery of two transformers of about 150 tonnes, ente",
 "lack of regulation": "EU Law and Directives The figure below attempts to show a hierarchy of legislative framework: In the most recent judicial review many legal commentators have argued that HumphreysJ's decision in Moss&OrsvAnCoimisiunPleanala[2026]IEHC62 (the Leamlara solarfarm case) exposed a tension between EU procedural supremacy under the EIADirective and the Irish courts' pragmatic approach to renewableenergy delivery. Objectors of this ruling say that the planning authority failed to conduct a thorough Environmental Impact Assessment (EIA). This observation asserts that the EIA requirement as covered under Directive2011/92/EU(asamendedby2014/52/EU) is absolutely essential and furthermore that the directive has explicit legal interpretations for the \"competent authority\".  It is absolutely imperative therefore that ACP which is designated as the Irish \"competent authority\" ensures all its legal obligations and  EU mandated requirements for the directive are completed and that the ACP has fully established all the requirements set forth in the document. Failure to do so places ACP in contravention of the directive and not compliant with the directive. ACP should consider its legal obligations for fully completing some of the following: Early indication of significant effects Cumulative assessment Elimination reason scientific doubt These must fully be satisfied by ACP ahead of granting permission. It is also imperative that ACP understand it cannot dilute or narrow/reduce its obligation to EIA with national laws. In practice  the position adapted by ACP should be to ensure it Acknowledge its EU-Level legal obligations Apply the directive to this application Avoid relying on a narrow interpretation as offered by Justice Humphreys Provide a legally defensible and independent EIA screening and assessment. It is not sufficient to rely on the applicants documents which might suffer from commercial bias. National Regulations See Minister response accepting the lack of guidelines relating to utility scale energy generation projects. It's a generally accepted principle that private developers and landowners are operating in a vacuum and planning authorities like the ACP are faced with enormous challenges weighing up applications against the minimal guidance at hand (or lack of).However It seems common practice for ACP to rely heavily on certain aspects of law whilst glossing over competing guidance. The Supreme court in a judgement in 2026 made reference to this by stating Renewableenergy projects are not automatically entitled to permission just because they align with climate targets.Section 15(1) of the Climate Action and Low Carbon Development Act 2015 imposes only a qualified duty. Meaning authorities like ACP must act \"insofar as practicable\" alongside climate action objections. In a nutshell an applicant cannot simply state utility scale solar contributes climate friendly action and be granted permission. ACP has to widen its focus beyond climate action targets. This broadening could include: Landscape Ecology cumulative impact agriculture versus industrial zoning loss of amenity and heritage Infrastructure constraints The onus is on ACP to defend the why for granting permission against other practicable considerations. It cannot state an immediate approval because of previous logic that renewables must be approved. Local Regulations There has been two planning applications marked invalid by Cork County council. Local councils should have primacy on deciding where it wants utility scale energy projects to reside. Local residents are very concerned that planners very far removed from the site will just not understand the implications involved i",
 "Lack of public consultation": "I wish to raise serious concerns regarding the adequacy, scope and effectiveness of the public engagement associated with this planning. While the applicant has submitted an Appendix A - Summary of Engagement 2025: Greenhills Renewable Energy Development, the existence of newsletters, telephone calls and individual meetings should not, of itself, be regarded as demonstrating that the wider affected community was afforded meaningful and effective participation in relation to the development ultimately submitted for consent. The applicant's own Summary of Engagement demonstrates that the direct engagement exercise was geographically restricted. It records that in February 2025 Newsletter 1 was delivered to approximately 342 houses within 1.5 km of the general site area, with 42 households within 1 km spoken to directly. Appendix A - Summary of Public  In August 2025, following earlier consultation sessions, a further invitation to consultation dates was posted to 334 houses within the 1.5 km area for which address information was available. The applicant also expressly acknowledges that a number of these letters were returned undelivered by An Post because they did not contain the name of the relevant resident or property. Appendix A - Summary of Public engagement.  The reality also was the not all these houses got these newsletters. This raises a legitimate question as to why 1.5 km was selected as the boundary for direct invitations to participate, and what assessment was undertaken to establish that households beyond that distance did not require the same direct notification. The potential effects associated with a substantial 220kV substation and associated grid infrastructure are not necessarily confined to residents situated within a fixed radius of the site. Persons outside that area may have an interest in, or potentially be affected by, landscape and visual effects, construction traffic, use of the local road network, environmental effects and cumulative effects associated with the wider Greenhills Renewable Energy Development. The number of newsletters distributed should therefore not be treated as synonymous with consultation with the full public potentially affected by the proposal. The form of consultation is also relevant. The applicant records that the August engagement at Inch Community Centre largely consisted of pre-booked individual appointments. It states that 36 face-to-face meetings took place during the first two consultation days, together with two virtual meetings and eight further appointments arranged afterwards. Appendix A - Summary of Public  While such meetings undoubtedly provided some individuals with an opportunity to ask questions, this is not necessarily equivalent to an open public engagement process in which the complete proposal could be presented collectively and broader community concerns concerning its overall scale and cumulative impacts could be openly discussed.  We can also attest that many others requested one to one meetings but were not facilitated. This concern is reinforced by the stage of design and level of information available when much of that engagement occurred. Newsletter 2 stated that the site layout for planning was still being drafted, that further refinement was likely before the planning application was submitted and that the material then being shown represented a study area within which the final development would be located. Appendix A - Summary of Public  The applicant's own subsequent account records that following Newsletter 3, residents raised concerns regarding the scale of the development and that many queries concerned its potential visual effects. Residents were advised that a book of photomontages would be provided as part of the planning application and were therefore waiting to see that information. Appendix A - Summary of Public  This is an important distinction. Consultation about the concept of a development is not the same as informed participation in relation to the development ultimately submitted for consent. Much of the engagement relied upon by the applicant occurred before the public had access to the completed layout, full environmental assessments, photomontages and other technical documentation now forming part of the planning application. The affected public could not therefore have examined or commented upon all of the information that is presently available to An Coimisiun Pleanala during much of the applicant's pre-application",
 "Cumulative effect": "Cumulative Effects - Greenhills Solar Farm, Lyrenacarriga Wind Farm and Associated Substation Infrastructure An Coimisiun Pleanala needs to draw attention to an important cumulative-impact issue arising in respect of the proposed 220kV substation development under Planning Ref. 324632, particularly in the context of the existing and proposed energy infrastructure in the area. Cork County Council previously identified the need for a proper cumulative assessment of the proposed 800-acre solar farm and the permitted Lyrenacarriga Wind Farm in its assessment of Planning Ref. 25/6876. The Council specifically requested that the Landscape and Visual Impact Assessment address the cumulative effects arising from the proximity of the two developments. However, the subsequent planning submission under Planning Ref. 26/2133 did not, adequately address the cumulative effects previously identified by Cork County Council. The absence of a meaningful cumulative assessment of the solar farm and Lyrenacarriga Wind Farm is particularly relevant when considering the current proposal for the 220kV substation under Planning Ref. 324632. The cumulative assessment should not be considered in isolation from the wider pattern of energy infrastructure being developed in this area. There are, or are proposed to be, two substantial substations approximately 4 km apart. An 110KV substation has already received planning permission (case reference: PA04.309121), while the current application seeks permission for a separate 220kV substation. The visual, landscape and construction impacts of the already-permitted 110kV substation and the proposed 220kV substation therefore need to be considered cumulatively, together with the wider solar and wind energy developments that they serve. It is also important that the 220kV substation has not been properly taken into consideration in the cumulative assessment associated with Planning Ref. 26/2133. The fact that the 220kV substation is being considered under a separate planning application should not mean that its potential cumulative effects can be disregarded when assessing the wider development of this energy-infrastructure cluster. Shared substation construction traffic route There is an additional cumulative issue arising from the proposed substation construction arrangements. The construction traffic associated with the two substations is proposed to utilise the R634. Consequently, the construction impacts of the separate substation developments cannot reasonably be considered entirely independently. The use of the same road for construction traffic creates the potential for cumulative impacts arising from: increased construction traffic on the R634; heavy goods vehicles and abnormal loads associated with the construction of the substations; increased traffic movements over potentially overlapping construction periods; interaction between construction traffic associated with the two developments; impacts on road users and local residents; and cumulative noise, disturbance, dust and road-safety impacts arising from construction activity. These matters warrant assessment irrespective of the fact that the two substations are being considered under separate planning applications. Requirement for a comprehensive cumulative assessment In these circumstances, An Coimisiun Pleanala should consider the proposed 220kV substation in the context of the existing, permitted and proposed energy infrastructure within the surrounding area, rather than assessing it as an isolated development. The cumulative assessment should, at a minimum, consider the interaction between: the approximately 800-acre solar farm; the permitted Lyrenacarriga Wind Farm; the permitted 110kV substation; the proposed 220kV substation under Planning Ref. 324632; and the associated transmission and other energy infrastructure forming part of these developments. Particular consideration should be given to the fact that Cork County Council had already identified the need for a cumulative assessment of the solar farm and Lyrenacarriga Wind Farm under Planning Ref. 25/6876, yet the subsequent Planning Ref. 26/2133 did not adequately provide the requested assessment. The cumulative effects should therefore be assessed both spatially and temporally, including the combined landscape and visual effects and the cumulative construction impacts where construction activities and traffic movements overlap. The fact that the developments are subject to sepa"
};

    const canonicalTopic = (text) => {
      const t = String(text || '').toLowerCase();
      for (const k of Object.keys(TOPIC_KEYS)) { if (t.includes(k)) return TOPIC_KEYS[k]; }
      return null;
    };

    const fullAddress = cleanText(findFormField(formData, ['Address', 'What is your address', 'Your Address']));
    const letterAddress = formatAddress(fullAddress);

    const distance = cleanText(findFormField(formData, ['How close do you live']));

    const occupation = cleanText(formData['What do you work at?'] || '');

    // Selected topics: any array answer whose values map to option texts that match a topic
    let selectedTopics = [];
    let selectedConcernLabels = [];
    fields.forEach(field => {
      if (!Array.isArray(field.value)) return;
      field.value.forEach(v => {
        const text = optionMap[v] || (typeof v === 'string' ? v : '');
        const topic = canonicalTopic(text);
        if (topic && !selectedTopics.includes(topic)) { selectedTopics.push(topic); selectedConcernLabels.push(String(text).trim() || topic); }
      });
    });
    console.log('Selected topics:', selectedTopics.join(', '));

    // User's own words per topic: text fields whose label mentions the topic and are not the checkbox list
    const topicText = {};
    fields.forEach(field => {
      if (Array.isArray(field.value)) return;
      if (typeof field.value !== 'string' || !field.value.trim()) return;
      const label = String(field.label || '');
      if (!/concern|worr|view|thought|say|tell/i.test(label)) return;
      const topic = canonicalTopic(label);
      if (topic && selectedTopics.includes(topic)) topicText[topic] = (topicText[topic] ? topicText[topic] + ' ' : '') + cleanText(field.value);
    });

    const concernCount = selectedTopics.length;
    let minWords, maxWords;
    if (concernCount <= 5) { minWords = 850; maxWords = 1050; }
    else { const extra = concernCount - 5; minWords = 850 + extra * 120; maxWords = 1050 + extra * 120; }
    console.log(`Selected ${concernCount} topics - Target: ${minWords}-${maxWords} words`);

    const additional = cleanText(findFormField(formData, ['additional concerns', 'anything else', 'other concerns']));
    const personal = cleanText(findFormField(formData, ['personal story', 'reason you wish to', 'why you are making']));
    const mostImportant = cleanText(findFormField(formData, ['most important']));

    let concernsList = '';
    selectedTopics.forEach(t => { concernsList += `${t}: ${topicText[t] || '(no personal comment given - use the facts)'}\n\n`; });
    if (mostImportant) concernsList += `PRIORITY: ${mostImportant}\n\n`;
    if (additional) concernsList += `ADDITIONAL: ${additional}\n\n`;
    if (personal) concernsList += `PERSONAL: ${personal}`;

    let committeeContext = '';
    if (selectedTopics.length) {
      committeeContext = '\n\nSUPPORTING FACTS (committee research on the application documents; use selectively, in your own words, do not copy long passages):\n';
      selectedTopics.forEach(t => { if (TOPIC_FACTS[t]) committeeContext += `\n[${t}]\n${TOPIC_FACTS[t]}\n`; });
    }


    const today = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const getOrdinal = (n) => { const s = ["th","st","nd","rd"]; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
    const formattedDate = `${getOrdinal(today.getDate())} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    const formatStyles = [
      'numbered sections with bold headings',
      'titled sections without numbers',
      'lettered sections (a, b, c) with underlined headings',
      'Roman numeral sections (I, II, III) with capitalized headings',
      'paragraphs introduced by short plain headings'
    ];
    const randomFormat = formatStyles[Math.floor(Math.random() * formatStyles.length)];


    const prompt = `You are a professional planning consultant helping an individual resident draft a formal Observation to An Coimisiun Pleanala on a Strategic Infrastructure Development.

CLIENT INFORMATION:
Name: ${firstName} ${lastName}${occupation ? `, ${occupation}` : ''}
Distance of home from the proposed development: ${distance || 'not stated'}

PLANNING APPLICATION DETAILS:
Case reference: VA04.324632 (ACP case file 324632)
Applicant: Perigus Energy Ireland Midco Ltd
Proposal: Construction of a 220kV Air Insulated Substation, loop-in grid connection and related works
Location: Townlands of Ballyneague, Ballydaniel and Knocknagappagh, County Cork. Access from the R634 (Youghal-Tallow Road) via a new entrance.
Important: this Observation concerns ONLY the substation application. The solar farm and battery storage are a separate application, but the substation is permanent: if the solar farm is decommissioned after 40 years the substation will remain.

CLIENT'S CONCERNS (in their own words):
${concernsList}

COMMITTEE RESEARCH AND FACTUAL BACKGROUND:
${committeeContext}

YOUR TASK:
Draft a formal, professional planning Observation that:
1. Presents the client's concerns in proper planning language and keeps strictly to the substation application
2. Uses specific local facts from the research above (document references, distances, drawing numbers) where relevant, and does not invent facts
3. References relevant Irish planning law and guidance only where you are confident it is correct
4. Keeps a professional, respectful tone and reflects the client's own voice and personal story. Do NOT invent personal circumstances (length of residence, family, occupation, health, feelings) that the client did not provide; if they gave no personal detail, write in a neutral resident voice
5. CRITICAL: the letter body MUST be ${minWords}-${maxWords} words. Do not exceed ${maxWords} words. Aim for the middle of that range and stop; being under is better than over.
6. Uses ${randomFormat} for the main points
7. Ends by respectfully asking the Commission to refuse permission, or at minimum to request further information on the matters raised

Write the letter starting with EXACTLY this format (fill in today's date, ${formattedDate}):

${formattedDate}

The Secretary
An Coimisiun Pleanala
64 Marlborough Street
Dublin 1
D01 V902

RE: OBSERVATION ON STRATEGIC INFRASTRUCTURE DEVELOPMENT - CASE REFERENCE VA04.324632
Applicant: Perigus Energy Ireland Midco Ltd
Proposed Development: 220kV Air Insulated Substation, loop-in grid connection and related works
Location: Ballyneague, Ballydaniel and Knocknagappagh, County Cork

Then proceed with the Observation using the salutation "Dear Sir/Madam,".

Focus on the client's concerns about: ${selectedConcernLabels.join(', ')}

Format requirements:
- Plain text only (no HTML)
- DO NOT use bullet points, em dashes, or special characters
- Use simple dashes (-) for lists if needed
- Use only standard ASCII characters
- Formal business letter style
- Conclude with "Is mise," and the client's name
Begin the letter now:`;

    const estimatedTokens = Math.ceil(maxWords * 2.0);
    const tokenCap = concernCount <= 7 ? estimatedTokens : 4096;
    const maxTokens = Math.min(estimatedTokens, tokenCap) + 4000; // headroom in case the model uses thinking tokens

    console.log(`Calling Claude API with ${maxTokens} max_tokens (${concernCount} concerns, ${minWords}-${maxWords} words, estimated ${estimatedTokens} tokens)...`);
    const apiCallStart = Date.now();

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const claudeResponse = await makeRequest(
      { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' } },
      JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    );

    const blocks = Array.isArray(claudeResponse.content) ? claudeResponse.content : [];
    console.log('Claude response: stop_reason=' + claudeResponse.stop_reason + ', blocks=' + blocks.map(b => b.type).join(',') + ', usage=' + JSON.stringify(claudeResponse.usage || {}));
    const generatedLetter = blocks.filter(b => b.type === 'text' && b.text).map(b => b.text).join('\n').trim();
    if (!generatedLetter) {
      throw new Error('Claude returned no text (stop_reason=' + claudeResponse.stop_reason + '). Likely max_tokens used up before the letter was written.');
    }
    const apiCallDuration = ((Date.now() - apiCallStart) / 1000).toFixed(1);
    console.log(`Letter generated in ${apiCallDuration}s (${generatedLetter.length} chars)`);

    const cleanedLetter = generatedLetter
      .replace(/<\/?u>/gi, '')
      .replace(/<\/?b>/gi, '')
      .replace(/<\/?i>/gi, '')
      .replace(/<\/?em>/gi, '')
      .replace(/<\/?strong>/gi, '')
      .replace(/[\u2022\u25CF\u25CB\u25E6\u2726]/g, '-')
      .replace(/^\s*[-\u2013\u2014]\s*/gm, '- ')
      .replace(/\u00e2\u0080\u0093/g, '-')
      .replace(/\u00e2\u0080\u0094/g, '-')
      .replace(/\u00e2\u0080\u0098/g, "'")
      .replace(/\u00e2\u0080\u0099/g, "'")
      .replace(/\u00e2\u0080\u009c/g, '"')
      .replace(/\u00e2\u0080\u009d/g, '"')
      .replace(/\u00e2\u0080\u00a2/g, '-')
      .replace(/\u00c3\u00a1/g, 'a')
      .replace(/\u00c3\u00a9/g, 'e')
      .replace(/\u00c3\u00ad/g, 'i')
      .replace(/\u00c3\u00b3/g, 'o')
      .replace(/\u00c3\u00ba/g, 'u')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2022\u2023\u2043]/g, '-')
      .replace(/[\u2026]/g, '...')
      .replace(/[^\x20-\x7E\n\r]/g, '');

    const letterWithAddress = letterAddress + '\n\n' + cleanedLetter;
    console.log('Address prepended to letter');

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
    const letterFilename = `Observation-${nameSafe}-${dateStr}-${timeStr}.txt`;

    console.log('Creating formatted text files...');
    const inputsContent = createInputsTextFile(formData, firstName, lastName, selectedConcernLabels);
    const letterContent = createLetterTextFile(letterWithAddress);

    console.log('Uploading to Dropbox...');
    const subfolderName = `${firstName}${lastName}-${dateStr}-${timeStr}`.replace(/[^a-zA-Z0-9-]/g, '');
    const dropboxInputs = await uploadToDropbox(inputsContent, inputsFilename, subfolderName);

    const letterDocFilename = letterFilename.replace('.txt', '.doc');

    function createRTF(text, firstNameArg, lastNameArg, formattedAddress) {
      let rtf = '{\\rtf1\\ansi\\deff0\n';
      rtf += '{\\fonttbl{\\f0\\fnil\\fcharset0 Times New Roman;}}\n';
      rtf += '\\viewkind4\\uc1\\pard\\lang2057\\f0\\fs22\n\n';

      const lines = text.split('\n');
      let restOfLetter = [];
      let foundDate = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/\d+(st|nd|rd|th)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/.test(line)) {
          foundDate = true;
          restOfLetter = lines.slice(i);
          break;
        }
      }

      if (!foundDate) {
        for (const line of lines) {
          if (line.trim() === '') {
            rtf += '\\par\n';
          } else {
            let escaped = line.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
            rtf += escaped + '\\par\n';
          }
        }
        rtf += '}\n';
        return rtf;
      }

      rtf += '\\qr\n';

      const fullName = firstNameArg + ' ' + lastNameArg;
      rtf += fullName.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}') + '\\par\n';

      let addressParts = formattedAddress.split(/[\n,]/).map(s => s.trim()).filter(s => s);

      if (addressParts.length === 1 && addressParts[0].length > 15) {
        const address = addressParts[0];
        const words = address.split(/\s+/);
        const lines2 = [];
        for (let i = 0; i < words.length; i += 2) {
          const chunk = words.slice(i, i + 2).join(' ');
          if (chunk) lines2.push(chunk);
        }
        addressParts = lines2;
      }

      for (const part of addressParts) {
        const escaped = part.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        rtf += escaped + '\\par\n';
      }
      rtf += '\\par\\par\n';

      rtf += '\\ql\n';

      for (const line of restOfLetter) {
        if (line.trim() === '') {
          rtf += '\\par\n';
        } else {
          let escaped = line.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
          if (escaped.startsWith('Re:')) {
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          } else if (/^(\d+\.|[A-Z]\)|\*\*|I+\.|[a-z]\))/.test(escaped) || escaped.includes('**')) {
            escaped = escaped.replace(/\*\*/g, '');
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          } else if (escaped === 'Is mise,' || escaped === firstNameArg + ' ' + lastNameArg) {
            rtf += '\\b ' + escaped + '\\b0\\par\n';
          } else {
            rtf += escaped + '\\par\n';
          }
        }
      }

      rtf += '}\n';
      return rtf;
    }

    const letterRTF = createRTF(letterContent, firstName, lastName, letterAddress);

    const dropboxDoc = await uploadToDropbox(letterRTF, letterDocFilename, subfolderName);
    console.log('DOC file uploaded to Dropbox:', dropboxDoc);

    // Upload both files to Google Drive as well (NEW in V33)
    console.log('Uploading to Google Drive...');
    const driveInputs = await uploadToGoogleDrive(inputsContent, inputsFilename, 'text/plain');
    const driveDoc = await uploadToGoogleDrive(letterRTF, letterDocFilename, 'application/rtf');
    console.log('Google Drive upload results:', { inputs: driveInputs, doc: driveDoc });

    const attachments = [
      { content: Buffer.from(letterRTF).toString('base64'), filename: letterDocFilename, type: 'application/msword', disposition: 'attachment' },
      { content: Buffer.from(inputsContent).toString('base64'), filename: inputsFilename, type: 'text/plain', disposition: 'attachment' }
    ];

    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .letter-box { background: #fff; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .instructions { background: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; }
    .attachments { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <h2>Your Personalised Observation</h2>
  <p>Dear ${firstName},</p>
  <p>Thank you for using the Greenhills Substation Observation Generator created by the <strong>Inch Killeagh Rural Preservation Group</strong>.</p>
  <div class="attachments">
    <h3>Attached Files:</h3>
    <p><strong>${letterDocFilename}</strong> - Your Observation (Word format - review before submitting)</p>
    <p><strong>${inputsFilename}</strong> - Your form inputs (text file - for your reference)</p>
    <p>Both files have also been saved to our shared Dropbox and Google Drive folders for committee records.</p>
  </div>
  <div class="letter-box">
    <h3>Your Generated Observation:</h3>
    <pre>${letterContent}</pre>
  </div>
  <div class="instructions">
    <h3>How to Submit Your Observation:</h3>
    <ol>
      <li>Open the attached Word document and review / edit it in your own words</li>
      <li>Submit online at <a href="https://www.pleanala.ie/en-ie/case/324632">www.pleanala.ie (case 324632)</a>, or by post to An Coimisiun Pleanala, 64 Marlborough Street, Dublin 1, D01 V902</li>
      <li>Fee: EUR 50 (debit or credit card online)</li>
      <li>Deadline: 5.30pm on 3 November 2026. Quote case reference VA04.324632.</li>
      <li>Need help? Book a clinic slot through the group.</li>
    </ol>
  </div>
  <p><em>In solidarity,<br>Inch Killeagh Rural Preservation Group</em></p>
</body>
</html>`;

    const emailBodyText = `
INCH KILLEAGH RURAL PRESERVATION GROUP
Substation Observation Service

Dear ${firstName},

Your personalized planning submission has been prepared based on your concerns.

ATTACHED FILES:
- ${letterDocFilename}
- ${inputsFilename}

In solidarity,
Inch Killeagh Rural Preservation Group
`;

    console.log('Sending email to:', email);
    const emailResult = await sendEmailViaSendGrid(
      email,
      `Your Substation Observation - Ref: ${firstName.substring(0,1)}${lastName.substring(0,3)}${dateStr}`,
      emailBodyHtml,
      emailBodyText,
      attachments
    );

    return res.status(200).json({
      success: true,
      message: 'Observation generated and saved',
      letter_length: cleanedLetter.length,
      email_status: emailResult,
      dropbox_status: { inputs: dropboxInputs, doc: dropboxDoc },
      googledrive_status: { inputs: driveInputs, doc: driveDoc },
      files: { inputs: inputsFilename, doc: letterDocFilename },
      version: 'substation-v1'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to generate observation', message: error.message });
  }
};
