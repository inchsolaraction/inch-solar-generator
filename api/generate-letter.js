// Inch Solar Development - Objection Letter Generator v3.0
// Complete system with SendGrid, Dropbox, and text file attachments

const https = require('https');

// Committee Research - EASY TO UPDATE
// Last updated: December 15, 2024 - Version 0.2 (DRAFT)
const COMMITTEE_RESEARCH = {
  archaeology: `There are 15 recorded monuments within 5km of the proposed site according to the National Monuments Service. The developer's EIAR has inadequately assessed the archaeological impact, particularly concerning Ring forts and Medieval sites in the immediate vicinity.`,
  
  flooding: `This exact site experienced significant flooding during Storm Babet in October 2023. Despite documented flooding events, no comprehensive flood risk assessment addressing climate change impacts has been conducted by the developer. The proposed drainage system is inadequate for extreme weather events.`,
  
  scale_and_size: `At over 800 acres, this proposal represents an industrialization of rural landscape on an unprecedented scale for this area. The cumulative impact of multiple large-scale solar developments in East Cork has not been adequately assessed.`,
  
  wildlife: `The site contains habitats for protected species including bats, badgers, and various bird species. The ecological impact assessment fails to address habitat fragmentation and the impact on local wildlife corridors.`,
  
  agricultural_land: `This development would result in the loss of 800+ acres of prime agricultural land. Once converted, this land will be lost to food production for 35+ years, directly contradicting national food security policies and the Food Vision 2030 strategy.`,
  
  traffic: `The narrow rural roads serving this area are unsuitable for the volume of construction traffic required. The developer has not adequately assessed the impact on road safety, particularly for school traffic and agricultural vehicles.`,
  
  planning_precedent: `Cork County Council has refused similar large-scale solar developments on grounds of scale, visual impact, and agricultural land loss. These concerns are directly applicable to the Inch proposal.`,
  
  community_engagement: `Despite over 200 signatures on a petition requesting it, no public meeting has been held by the developer. This represents a failure to meaningfully engage with the affected community as required under planning guidelines.`,
  
  legislation: `Current planning legislation is inadequate for developments of this scale. The developer can place panels right up to property boundaries without adequate setback requirements, directly impacting residential amenity.`,
  
  decommissioning: `The decommissioning plan is vague and provides no financial security for site restoration. Who will bear the cost of decommissioning if the developer becomes insolvent?`,
  
  property_impact: `Properties within 500m of industrial-scale solar farms have documented impacts on property values, visual amenity, and quality of life. These impacts are not adequately addressed in the developer's assessment.`
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

// Build committee context
function buildCommitteeContext(concerns) {
  let context = '\n\nVERIFIED COMMUNITY RESEARCH (use these FACTS to support the respondent\'s concerns):\n';
  
  if (concerns.archaeology) context += `\n[ARCHAEOLOGY FACTS]: ${COMMITTEE_RESEARCH.archaeology}`;
  if (concerns.flooding) context += `\n[FLOODING FACTS]: ${COMMITTEE_RESEARCH.flooding}`;
  if (concerns.location_scale) context += `\n[SCALE FACTS]: ${COMMITTEE_RESEARCH.scale_and_size}`;
  if (concerns.wildlife) context += `\n[WILDLIFE FACTS]: ${COMMITTEE_RESEARCH.wildlife}`;
  if (concerns.agricultural_land) context += `\n[AGRICULTURAL FACTS]: ${COMMITTEE_RESEARCH.agricultural_land}`;
  if (concerns.road_safety || concerns.road_infrastructure) context += `\n[TRAFFIC FACTS]: ${COMMITTEE_RESEARCH.traffic}`;
  if (concerns.lack_engagement) context += `\n[ENGAGEMENT FACTS]: ${COMMITTEE_RESEARCH.community_engagement}`;
  if (concerns.lack_legislation) context += `\n[LEGISLATION FACTS]: ${COMMITTEE_RESEARCH.legislation}`;
  if (concerns.decommissioning) context += `\n[DECOMMISSIONING FACTS]: ${COMMITTEE_RESEARCH.decommissioning}`;
  if (concerns.property_devaluation) context += `\n[PROPERTY FACTS]: ${COMMITTEE_RESEARCH.property_impact}`;
  
  return context;
}

// Create formatted text file for inputs
function createInputsTextFile(formData, firstName, lastName) {
  const timestamp = new Date().toLocaleString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  let content = `${'='.repeat(80)}\n`;
  content += `TALLY FORM SUBMISSION - USER INPUTS\n`;
  content += `${'='.repeat(80)}\n\n`;
  content += `Respondent: ${firstName} ${lastName}\n`;
  content += `Generated: ${timestamp}\n\n`;
  content += `${'='.repeat(80)}\n`;
  content += `RESPONDENT INFORMATION\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Add basic fields
  for (const [key, value] of Object.entries(formData)) {
    if (!value || value === '' || key.startsWith('question_eREaMx')) continue;
    
    let label = key.replace(/^question_[A-Za-z0-9]+,?\s*/, '').trim();
    if (label && label.length < 100) {
      content += `${label}:\n${String(value)}\n\n`;
    }
  }
  
  content += `${'='.repeat(80)}\n`;
  content += `DETAILED CONCERNS\n`;
  content += `${'='.repeat(80)}\n\n`;
  
  // Add concern fields
  const concernFields = Object.entries(formData).filter(([key]) => 
    key.includes('What are your concerns around')
  );
  
  for (const [key, value] of concernFields) {
    if (!value || value === '') continue;
    let label = key.replace(/^question_[A-Za-z0-9]+,?\s*/, '').trim();
    content += `${label}:\n${String(value)}\n\n`;
  }
  
  content += `${'='.repeat(80)}\n`;
  content += `END OF SUBMISSION\n`;
  content += `${'='.repeat(80)}\n`;
  
  return content;
}

// Create formatted text file for letter
function createLetterTextFile(letterText, firstName, lastName) {
  const timestamp = new Date().toLocaleString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
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
    
    console.log('Email sent via SendGrid');
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
    
    // Extract basic info
    const firstName = cleanText(formData['First Name'] || '');
    const lastName = cleanText(formData['Last name'] || '');
    let email = String(formData['Email'] || '').trim().toLowerCase();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('Invalid email:', email);
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const distance = cleanText(formData['How close do you live to the proposed solar development?\n'] || '');
    const houseNumber = cleanText(formData['Can you find your house on this map? If so, what number is it? \nIf not, you can skip this question\n(note to view a bigger image, you can right click and open in a new tab to zoom with your browser)'] || '');
    const occupation = cleanText(formData['What do you work at?'] || '');
    
    // Extract concerns
    const concerns = {
      food_security: cleanText(formData['What are your concerns around Food Security \n'] || ''),
      river_pollution: cleanText(formData['What are your concerns around River Pollution\n'] || ''),
      well_contamination: cleanText(formData['What are your concerns around Well Contamination \n'] || ''),
      flooding: cleanText(formData['What are your concerns around Flooding'] || ''),
      mental_health: cleanText(formData['What are your concerns around Mental health'] || ''),
      glint_glare: cleanText(formData['What are your concerns around Glint and glare'] || ''),
      location_scale: cleanText(formData['What are your concerns around Location, Scale and size'] || ''),
      noise_vibration: cleanText(formData['What are your concerns around Noise &amp; vibration'] || ''),
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
      battery_fire: cleanText(formData['What are your concerns around Battery Storage and fire risk'] || ''),
      property_devaluation: cleanText(formData['What are your concerns around Devaluation of property'] || ''),
      agricultural_land: cleanText(formData['What are your concerns around Loss of agricultural land'] || ''),
      additional_concerns: cleanText(formData['Do you have additional concerns that are were not listed?'] || ''),
      personal_story: cleanText(formData['Can you share a personal story and reason you wish to object.\n'] || '')
    };
    
    const committeeContext = buildCommitteeContext(concerns);
    
    const concernsList = Object.entries(concerns)
      .filter(([key, value]) => value && value.length > 0)
      .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
      .join('\n\n');
    
    const prompt = `You are an expert at writing formal planning objection submissions for Irish planning applications.

Generate a personalized, professional objection letter to Cork County Council regarding the Inch Solar Development (Greenhills Solar Farm).

RESPONDENT: ${firstName} ${lastName}, ${email}, Distance: ${distance}, House: ${houseNumber}, Occupation: ${occupation}

RESPONDENT'S PERSONAL CONCERNS (PRIMARY CONTENT - USE EXTENSIVELY):
${concernsList}

${committeeContext}

CRITICAL INSTRUCTIONS:
1. Use the respondent's OWN WORDS and concerns as the PRIMARY content
2. When the respondent provides specific details, USE THEM VERBATIM in the letter
3. Support their concerns with relevant community research facts (marked with [FACTS] above)
4. Cite specific facts when backing up each concern - e.g. "This concern is supported by documented evidence showing..."
5. Make it 1200-1400 words following Cork County Council format
6. Structure: Address, Date, Council details, "Re: Objection...", "A Chara", detailed grounds, personal impact, conclusion, "Mise le Meas"
7. Use clear section headings for concern categories
8. Reference Irish planning guidelines
9. Professional tone, varied structure
10. Include personal story prominently
11. Planning reference: [PLANNING REF - TO BE INSERTED]

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
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const nameSafe = `${firstName}${lastName}`.replace(/[^a-zA-Z]/g, '');
    
    const inputsFilename = `Inputs-${nameSafe}-${dateStr}-${timeStr}.txt`;
    const letterFilename = `Letter-${nameSafe}-${dateStr}-${timeStr}.txt`;
    
    // Generate text files
    console.log('Creating text files...');
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
      <li><strong>${inputsFilename}</strong> - Your form submissions</li>
      <li><strong>${letterFilename}</strong> - Your generated objection letter</li>
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
      <li>Download the attached letter file</li>
      <li>Review and make any personal edits</li>
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
      version: '3.0'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to generate letter',
      message: error.message
    });
  }
};
