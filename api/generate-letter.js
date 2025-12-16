// Inch Solar Development - Objection Letter Generator v3.0 FINAL
// Complete system with SendGrid, Dropbox, formatted text files, and all Tally fields

const https = require('https');

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

// Build committee context based on selected concerns
function buildCommitteeContext(concerns) {
  let context = '\n\nVERIFIED COMMUNITY RESEARCH (use these FACTS to support the respondent\'s concerns):\n';
  
  const mapping = {
    'food_security': concerns.food_security,
    'river_pollution': concerns.river_pollution,
    'well_contamination': concerns.well_contamination,
    'flooding': concerns.flooding,
    'mental_health': concerns.mental_health,
    'glint_glare': concerns.glint_glare,
    'location_scale': concerns.location_scale,
    'noise_vibration': concerns.noise_vibration,
    'no_plan': concerns.no_plan,
    'lack_legislation': concerns.lack_legislation,
    'wildlife': concerns.wildlife,
    'children': concerns.children,
    'road_safety': concerns.road_safety,
    'road_infrastructure': concerns.road_infrastructure,
    'lack_engagement': concerns.lack_engagement,
    'decommissioning': concerns.decommissioning,
    'archaeology': concerns.archaeology,
    'flora_fauna': concerns.flora_fauna,
    'privacy': concerns.privacy,
    'visual_impact': concerns.visual_impact,
    'economic_impact': concerns.economic_impact,
    'battery_fire': concerns.battery_fire,
    'property_devaluation': concerns.property_devaluation,
    'agricultural_land': concerns.agricultural_land,
    'security': concerns.security,
    'quality_components': concerns.quality_components,
    'industrialisation': concerns.industrialisation,
    'air_traffic': concerns.air_traffic,
    'existing_renewables': concerns.existing_renewables,
    'adjacent_renewables': concerns.adjacent_renewables
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (value && COMMITTEE_RESEARCH[key]) {
      context += `\n[${key.toUpperCase().replace(/_/g, ' ')} FACTS]: ${COMMITTEE_RESEARCH[key]}`;
    }
  }
  
  return context;
}

// Create formatted text file for inputs
function createInputsTextFile(formData, firstName, lastName) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  
  let content = `${'='.repeat(80)}\n`;
  content += `TALLY FORM SUBMISSION - USER INPUTS\n`;
  content += `${'='.repeat(80)}\n\n`;
  content += `Respondent: ${firstName} ${lastName}\n`;
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
  
  // Add main concerns checklist
  if (formData['What are your main concerns with the Solar Development ?']) {
    content += `Main Concerns Selected:\n${formData['What are your main concerns with the Solar Development ?']}\n\n`;
  }
  
  content += `${'='.repeat(80)}\n`;
  content += `DETAILED CONCERNS\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Add all concern detail fields
  const concernFields = Object.entries(formData).filter(([key]) => 
    key.startsWith('What are your concerns around')
  );
  
  for (const [key, value] of concernFields) {
    if (value && value.trim()) {
      const cleanKey = key.replace(/^What are your concerns around /, '').replace(/\n/g, '').trim();
      content += `${cleanKey}:\n${value}\n\n`;
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
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  
  let content = `${'='.repeat(80)}\n`;
  content += `OBJECTION LETTER - INCH SOLAR DEVELOPMENT\n`;
  content += `${'='.repeat(80)}\n\n`;
  content += `Respondent: ${firstName} ${lastName}\n`;
  content += `Generated: ${timestamp}\n\n`;
  content += `${'='.repeat(80)}\n`;
  content += `PLANNING OBJECTION LETTER\n`;
  content += `${'='.repeat(80)}\n\n`;
  content += letterText;
  content += `\n\n${'='.repeat(80)}\n`;
  content += `END OF LETTER\n`;
  content += `${'='.repeat(80)}\n`;
  
  return content;
}

// Upload to Dropbox
async function uploadToDropbox(content, fileName) {
  const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
  
  if (!dropboxToken) {
    console.log('DROPBOX_ACCESS_TOKEN not configured');
    return { success: false, message: 'Dropbox not configured' };
  }
  
  try {
    const buffer = Buffer.from(content, 'utf8');
    
    const response = await makeRequest(
      {
        hostname: 'content.dropboxapi.com',
        path: '/2/files/upload',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dropboxToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/Inch Solar Objections/${fileName}`,
            mode: 'add',
            autorename: true,
            mute: false
          })
        }
      },
      buffer
    );
    
    console.log('Uploaded to Dropbox:', fileName);
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
        email: 'inchsolaraction@gmail.com',
        name: 'Inch Community Action Group'
      },
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

  try {
    console.log('Received webhook from Tally');
    
    const webhookData = req.body.data || req.body;
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
      '849fda9b-84f1-48e6-9bfa-f24c29a7ea0a': '<500m',
      '98ba1248-f87b-4b89-9f81-4a57ddd37237': '<1km',
      '33468851-48d5-4e2c-881d-369540cf00c0': '1-3km',
      '0ee91f31-2e21-44d8-91b4-fa4015e2d91a': '3-5km',
      'b5893382-0a9e-471f-aa71-263b83b912ea': '5km+'
    };
    
    // Extract basic info
    const firstName = cleanText(formData['First Name'] || '');
    const lastName = cleanText(formData['Last name'] || '');
    let email = String(formData['Email'] || '').trim().toLowerCase();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('Invalid email:', email);
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const address = cleanText(formData['Address'] || '');
    const distanceRaw = cleanText(formData['How close do you live to the proposed solar development?\n'] || formData['How close do you live to the proposed solar development?'] || '');
    const distance = DISTANCE_UUID_MAP[distanceRaw] || distanceRaw;
    const occupation = cleanText(formData['What do you work at?'] || '');
    
    // Parse selected concerns from UUID string
    const concernsRaw = formData['What are your main concerns with the Solar Development ?\n'] || formData['What are your main concerns with the Solar Development ?'] || '';
    const selectedConcernUUIDs = concernsRaw.split(',').map(uuid => uuid.trim()).filter(uuid => uuid);
    const selectedConcernLabels = selectedConcernUUIDs.map(uuid => CONCERN_UUID_MAP[uuid]).filter(label => label);
    
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
    
    const committeeContext = buildCommitteeContext(concerns);
    
    // Build concerns list with BOTH selected labels AND detailed responses
    let concernsList = '';
    
    // Add selected concern labels first
    if (selectedConcernLabels.length > 0) {
      concernsList += 'SELECTED CONCERNS:\n' + selectedConcernLabels.join(', ') + '\n\n';
    }
    
    // Add detailed responses for each concern
    const detailedConcerns = Object.entries(concerns)
      .filter(([key, value]) => value && value.length > 0 && key !== 'additional_concerns' && key !== 'most_important' && key !== 'personal_story')
      .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
      .join('\n\n');
    
    if (detailedConcerns) {
      concernsList += 'DETAILED CONCERNS:\n' + detailedConcerns;
    }
    
    // Add most important concerns if provided
    if (concerns.most_important) {
      concernsList += '\n\nMOST IMPORTANT CONCERNS:\n' + concerns.most_important;
    }
    
    // Add additional concerns if provided
    if (concerns.additional_concerns) {
      concernsList += '\n\nADDITIONAL CONCERNS:\n' + concerns.additional_concerns;
    }
    
    // Add personal story if provided
    if (concerns.personal_story) {
      concernsList += '\n\nPERSONAL STORY:\n' + concerns.personal_story;
    }
    
    const prompt = `You are an expert at writing formal planning objection submissions for Irish planning applications.

Generate a personalized, professional objection letter to Cork County Council regarding the Inch Solar Development (Greenhills Solar Farm).

RESPONDENT: ${firstName} ${lastName}
Email: ${email}
Address: ${address}
Distance from Development: ${distance}
Occupation: ${occupation}

RESPONDENT'S PERSONAL CONCERNS (PRIMARY CONTENT - USE EXTENSIVELY):
${concernsList}

${committeeContext}

CRITICAL INSTRUCTIONS:
1. The respondent specifically selected these concerns: ${selectedConcernLabels.join(', ')}
2. You MUST write detailed sections addressing EACH of these selected concerns
3. Use the respondent's OWN WORDS from their detailed concern responses
4. Support EACH concern with relevant community research facts (marked with [FACTS] above)
5. Structure the letter with clear headings for each concern category the respondent selected
6. Make it 1200-1400 words following Cork County Council format
7. Use: Address, Date, Council details, "Re: Objection...", "A Chara", detailed grounds using ALL respondent's concerns, personal impact, conclusion, "Mise le Meas"
8. Reference Irish planning guidelines where relevant
9. Professional tone, varied sentence structure
10. If the respondent provided "most important concerns" or personal story, feature these prominently
11. Planning reference: [PLANNING REF - TO BE INSERTED]
12. EVERY concern the respondent ticked must have its own section with supporting facts

Example structure:
## GROUNDS OF OBJECTION
### 1. [First Selected Concern]
[Respondent's words + supporting facts]
### 2. [Second Selected Concern]
[Respondent's words + supporting facts]
[Continue for ALL selected concerns]

Generate the complete formal objection letter now.`;

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
        max_tokens: 3500,
        messages: [{ role: 'user', content: prompt }]
      })
    );
    
    const generatedLetter = claudeResponse.content[0].text;
    console.log('Letter generated (' + generatedLetter.length + ' chars)');
    
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
    const inputsContent = createInputsTextFile(formData, firstName, lastName);
    const letterContent = createLetterTextFile(generatedLetter, firstName, lastName);
    
    // Upload to Dropbox
    console.log('Uploading to Dropbox...');
    const dropboxInputs = await uploadToDropbox(inputsContent, inputsFilename);
    const dropboxLetter = await uploadToDropbox(letterContent, letterFilename);
    
    // Prepare email attachments
    const attachments = [
      {
        content: Buffer.from(inputsContent).toString('base64'),
        filename: inputsFilename,
        type: 'text/plain',
        disposition: 'attachment'
      },
      {
        content: Buffer.from(letterContent).toString('base64'),
        filename: letterFilename,
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
  
  <p>Thank you for using the Inch Solar Development Submission Generator created by the <strong>Inch Killeagh Rural Preservation Group</strong>.</p>
  
  <div class="attachments">
    <h3>📎 ATTACHED FILES:</h3>
    <ul>
      <li><strong>${inputsFilename}</strong> - Your form submissions (formatted for easy reading)</li>
      <li><strong>${letterFilename}</strong> - Your generated objection letter (formatted and ready to submit)</li>
    </ul>
    <p>Both files have also been saved to our shared Dropbox folder for committee records.</p>
  </div>
  
  <div class="section">
    <h3>📝 YOUR SUBMITTED CONCERNS:</h3>
    ${inputSummary}
  </div>
  
  <div class="letter-box">
    <h3>📄 YOUR GENERATED OBJECTION LETTER:</h3>
    <pre>${generatedLetter}</pre>
  </div>
  
  <div class="instructions">
    <h3>📋 HOW TO SUBMIT:</h3>
    <ol>
      <li>Download the attached letter file (${letterFilename})</li>
      <li>Review and make any personal edits you wish</li>
      <li>Submit online at: <a href="https://www.corkcoco.ie">www.corkcoco.ie</a></li>
      <li>€20 submission fee required</li>
      <li>Include planning reference when available</li>
      <li>Submit within 35 days of application being lodged</li>
    </ol>
  </div>
  
  <p><em>In solidarity,<br>Inch Killeagh Rural Preservation Group</em></p>
</body>
</html>`;
    
    const emailBodyText = `Your Personalized Objection Letter\n\n${generatedLetter}\n\nAttached: ${inputsFilename}, ${letterFilename}`;
    
    // Send email
    console.log('Sending email to:', email);
    const emailResult = await sendEmailViaSendGrid(
      email,
      'Your Objection Letter - Inch Solar Development',
      emailBodyHtml,
      emailBodyText,
      attachments
    );
    
    return res.status(200).json({
      success: true,
      message: 'Letter generated, emailed, and saved',
      letter_length: generatedLetter.length,
      email_status: emailResult,
      dropbox_status: { inputs: dropboxInputs, letter: dropboxLetter },
      files: { inputs: inputsFilename, letter: letterFilename },
      version: '3.0-final'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to generate letter',
      message: error.message
    });
  }
};
