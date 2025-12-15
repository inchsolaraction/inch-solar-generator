// Inch Solar Development - Objection Letter Generator v2.0
// Now with Word document generation and Dropbox storage

const https = require('https');
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const { Dropbox } = require('dropbox');

// Committee Research - EASY TO UPDATE
// Last updated: December 11, 2024 - Version 0.2 (DRAFT)
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

// Clean text to remove control characters
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

// Build context from committee research
function buildCommitteeContext(concerns) {
  let context = '\n\nIMPORTANT LOCAL CONTEXT (verified by community research):\n';
  
  if (concerns.archaeology) context += `\nArchaeology: ${COMMITTEE_RESEARCH.archaeology}`;
  if (concerns.flooding) context += `\nFlooding: ${COMMITTEE_RESEARCH.flooding}`;
  if (concerns.location_scale) context += `\nScale: ${COMMITTEE_RESEARCH.scale_and_size}`;
  if (concerns.wildlife) context += `\nWildlife: ${COMMITTEE_RESEARCH.wildlife}`;
  if (concerns.agricultural_land) context += `\nAgricultural Land: ${COMMITTEE_RESEARCH.agricultural_land}`;
  if (concerns.road_safety || concerns.road_infrastructure) context += `\nTraffic: ${COMMITTEE_RESEARCH.traffic}`;
  if (concerns.lack_engagement) context += `\nCommunity Engagement: ${COMMITTEE_RESEARCH.community_engagement}`;
  if (concerns.lack_legislation) context += `\nLegislation: ${COMMITTEE_RESEARCH.legislation}`;
  if (concerns.decommissioning) context += `\nDecommissioning: ${COMMITTEE_RESEARCH.decommissioning}`;
  if (concerns.property_devaluation) context += `\nProperty Impact: ${COMMITTEE_RESEARCH.property_impact}`;
  
  return context;
}

// Create Word document for user inputs
async function createInputsDocument(formData, firstName, lastName) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "TALLY FORM SUBMISSION - USER INPUTS",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Generated: ", bold: true }),
            new TextRun(new Date().toLocaleString()),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "RESPONDENT INFORMATION",
          heading: HeadingLevel.HEADING_2,
        }),
        ...createFieldParagraphs(formData, 'basic'),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "CONCERNS PROVIDED",
          heading: HeadingLevel.HEADING_2,
        }),
        ...createFieldParagraphs(formData, 'concerns'),
      ],
    }],
  });
  
  return doc;
}

// Create Word document for objection letter
async function createLetterDocument(letterText, firstName, lastName) {
  const paragraphs = letterText.split('\n\n').map(para => 
    new Paragraph({
      text: para.trim(),
      spacing: { after: 200 },
    })
  );
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  
  return doc;
}

// Helper to create paragraphs from form data
function createFieldParagraphs(formData, type) {
  const paragraphs = [];
  
  for (const [key, value] of Object.entries(formData)) {
    if (!value || value === '') continue;
    
    // Clean up the label
    let label = key.replace(/^question_[A-Za-z0-9]+,?\s*/, '').trim();
    if (!label) continue;
    
    paragraphs.push(
      new Paragraph({ text: "" }),
      new Paragraph({
        children: [
          new TextRun({ text: label, bold: true }),
        ],
      }),
      new Paragraph({
        text: String(value),
      })
    );
  }
  
  return paragraphs;
}

// Upload to Dropbox
async function uploadToDropbox(fileBuffer, fileName) {
  const dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
  
  if (!dropboxToken) {
    console.log('DROPBOX_ACCESS_TOKEN not configured - skipping upload');
    return { success: false, message: 'Dropbox not configured' };
  }
  
  try {
    const dbx = new Dropbox({ accessToken: dropboxToken });
    
    const response = await dbx.filesUpload({
      path: `/Inch Solar Objections/${fileName}`,
      contents: fileBuffer,
      mode: 'add',
      autorename: true,
    });
    
    console.log('Uploaded to Dropbox:', fileName);
    return { success: true, path: response.result.path_display };
    
  } catch (error) {
    console.error('Dropbox upload failed:', error.message);
    return { success: false, message: error.message };
  }
}

// Send email via Resend with attachments
async function sendEmailWithAttachments(to, subject, htmlBody, textBody, attachments) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured - email not sent');
    return { success: false, message: 'Email API key not configured' };
  }
  
  try {
    const emailData = {
      from: 'Inch Community <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: htmlBody,
      text: textBody,
      attachments: attachments || []
    };
    
    const response = await makeRequest(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        }
      },
      JSON.stringify(emailData)
    );
    
    console.log('Email sent successfully via Resend');
    return { success: true, id: response.id };
    
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, message: error.message };
  }
}

// Main handler function
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received webhook from Tally');
    
    const webhookData = req.body.data || req.body;
    const fields = webhookData.fields || [];
    
    // Convert Tally fields array to simple object
    const formData = {};
    fields.forEach(field => {
      if (field.key && field.value !== undefined) {
        formData[field.key] = field.value;
        if (field.label) {
          formData[field.label] = field.value;
        }
      }
    });
    
    console.log('Extracted field keys:', Object.keys(formData).slice(0, 10).join(', '), '...');
    
    // Extract basic info
    const firstName = cleanText(formData['First Name'] || '');
    const lastName = cleanText(formData['Last name'] || '');
    let email = String(formData['Email'] || '').trim().toLowerCase();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error('Invalid email:', email);
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const distance = cleanText(formData['How close do you live to the proposed solar development?\n'] || '');
    const houseNumber = cleanText(formData['Can you find your house on this map? If so, what number is it? \nIf not, you can skip this question\n(note to view a bigger image, you can right click and open in a new tab to zoom with your browser)'] || '');
    const occupation = cleanText(formData['What do you work at?'] || '');
    
    // Extract ALL concern fields - these are the detailed text responses
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
    
    // Build committee context
    const committeeContext = buildCommitteeContext(concerns);
    
    // Build detailed prompt with ALL user concerns
    const concernsList = Object.entries(concerns)
      .filter(([key, value]) => value && value.length > 0)
      .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
      .join('\n\n');
    
    const prompt = `You are an expert at writing formal planning objection submissions for Irish planning applications following Cork County Council guidelines.

Generate a personalized, professional objection letter to Cork County Council regarding the proposed Inch Solar Development (Greenhills Solar Farm).

RESPONDENT INFORMATION:
Name: ${firstName} ${lastName}
Email: ${email}
Distance from development: ${distance}
Property reference: House ${houseNumber}
Occupation: ${occupation}

PERSONAL CONCERNS PROVIDED BY RESPONDENT (USE THESE EXTENSIVELY):
${concernsList}

${committeeContext}

INSTRUCTIONS:
Generate a 1200-1400 word formal Irish planning objection letter that:

1. Follows the Cork County Council format exactly
2. Uses this structure:
   [Respondent's Address]
   [Date]
   
   The Secretary,
   Planning Department,
   Cork County Council,
   County Hall,
   Cork.
   
   Re: Objection to Inch Solar Development (Greenhills Solar Farm)
   Planning Application Reference: [PLANNING REF - TO BE INSERTED]
   
   A Chara,
   
   [Introduction paragraph]
   [Detailed grounds for objection - organized by theme]
   [Personal impact section]
   [Conclusion requesting refusal]
   
   Mise le Meas,
   ${firstName} ${lastName}

3. CRITICAL: Incorporate the respondent's personal concerns extensively - use their own words and examples where provided
4. Weave in relevant committee research to strengthen their personal points
5. Use clear section headings for different concern categories
6. Reference Irish planning guidelines and policies where relevant
7. Maintain professional, respectful tone throughout
8. Include the personal story prominently
9. Focus on legitimate planning considerations only
10. Vary the structure and phrasing naturally
11. Make it detailed and comprehensive - aim for 1200-1400 words

IMPORTANT: 
- This is a formal planning objection - be thorough and detailed
- Use the respondent's own concerns as the primary content
- Support their concerns with committee research where applicable
- Skip only concerns where NO information was provided
- Make it sound human-written, not AI-generated`;

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
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    );
    
    const generatedLetter = claudeResponse.content[0].text;
    console.log('Letter generated successfully (' + generatedLetter.length + ' chars)');
    
    // Create timestamp for filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '-');
    const filenameSafe = `${firstName}-${lastName}`.replace(/[^a-zA-Z0-9-]/g, '');
    
    // Generate Word documents
    console.log('Generating Word documents...');
    const inputsDoc = await createInputsDocument(formData, firstName, lastName);
    const letterDoc = await createLetterDocument(generatedLetter, firstName, lastName);
    
    // Note: Word document generation requires additional libraries not available in serverless
    // For now, we'll send the content as plain text and implement Word generation in Phase 2
    
    // Build email with input summary
    const inputSummary = Object.entries(concerns)
      .filter(([key, value]) => value && value.length > 0)
      .map(([key, value]) => `<strong>${key.replace(/_/g, ' ').toUpperCase()}:</strong><br>${value}`)
      .join('<br><br>');
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .section { background: #f9f9f9; border: 1px solid #ddd; padding: 20px; margin: 20px 0; }
    .letter-box { background: #fff; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; }
    .instructions { background: #e8f4f8; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Your Personalized Objection Letter - TESTING VERSION</h2>
    
    <p>Dear ${firstName},</p>
    
    <p>Thank you for using the Inch Solar Development Submission Generator (TESTING PHASE).</p>
    
    <div class="section">
      <h3>📝 YOUR SUBMITTED CONCERNS:</h3>
      <p><em>Review these to verify what you entered was used in the letter below:</em></p>
      ${inputSummary}
    </div>
    
    <div class="letter-box">
      <h3>📄 YOUR GENERATED OBJECTION LETTER:</h3>
      <pre>${generatedLetter}</pre>
    </div>
    
    <div class="instructions">
      <h3>📋 NEXT STEPS:</h3>
      <ol>
        <li><strong>REVIEW:</strong> Compare your input above with the generated letter</li>
        <li><strong>FEEDBACK:</strong> Let us know if anything is missing or incorrect</li>
        <li><strong>SUBMIT:</strong> Once finalized, submit to Cork County Council at www.corkcoco.ie</li>
        <li><strong>FEE:</strong> €20 submission fee required</li>
        <li><strong>DEADLINE:</strong> Within 35 days of planning application being lodged</li>
      </ol>
    </div>
    
    <p><em>In solidarity,<br>Inch Killeagh Rural Preservation Group</em></p>
  </div>
</body>
</html>`;
    
    // Send email
    console.log('Sending email to:', email);
    const emailResult = await sendEmailWithAttachments(
      email,
      'Your Objection Letter - TESTING VERSION',
      emailBodyHtml,
      generatedLetter,
      [] // Attachments will be added in Phase 2
    );
    
    return res.status(200).json({
      success: true,
      message: 'Letter generated and email sent',
      letter_length: generatedLetter.length,
      email_status: emailResult,
      concerns_used: Object.keys(concerns).filter(k => concerns[k]).length,
      version: '2.0-testing'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to generate letter',
      message: error.message
    });
  }
};
