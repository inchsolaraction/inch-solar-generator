// Inch Solar Development - Objection Letter Generator
// Serverless function for Vercel
// Receives Tally form data, generates personalized letter via Claude API, sends email

const https = require('https');

// Committee Research - EASY TO UPDATE
// Last updated: December 10, 2024 - Version 0.2 (DRAFT)
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
          resolve(JSON.parse(body));
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

// Clean text to remove control characters that break JSON
function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\n/g, ' ')  // Replace newlines with spaces
    .replace(/\r/g, '')   // Remove carriage returns
    .replace(/\t/g, ' ')  // Replace tabs with spaces
    .replace(/"/g, "'")   // Replace double quotes with single quotes
    .replace(/\\/g, '')   // Remove backslashes
    .trim();
}

// Build context from committee research based on selected concerns
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

// Send email via Gmail SMTP (using nodemailer simulation with raw SMTP)
async function sendEmail(to, subject, body) {
  // For Vercel, we'll use a simple HTTP email API instead of SMTP
  // This is a placeholder - in production use Resend or SendGrid
  console.log(`Email would be sent to: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body length: ${body.length} chars`);
  return { success: true, message: 'Email sent (simulated)' };
}

// Main handler function
module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received webhook from Tally');
    
    // Extract form data from Tally webhook
    const formData = req.body.data || req.body;
    
    // Extract basic fields
    const firstName = cleanText(formData.first_name || formData['First Name'] || '');
    const lastName = cleanText(formData.last_name || formData['Last name'] || '');
    const email = cleanText(formData.email || formData['Email'] || '');
    const distance = cleanText(formData.distance || '');
    const houseNumber = cleanText(formData.house_number || '');
    const occupation = cleanText(formData.occupation || '');
    
    // Extract concern fields (cleaned)
    const concerns = {
      food_security: cleanText(formData.food_security || ''),
      river_pollution: cleanText(formData.river_pollution || ''),
      well_contamination: cleanText(formData.well_contamination || ''),
      flooding: cleanText(formData.flooding || ''),
      mental_health: cleanText(formData.mental_health || ''),
      glint_glare: cleanText(formData.glint_glare || ''),
      location_scale: cleanText(formData.location_scale || ''),
      noise_vibration: cleanText(formData.noise_vibration || ''),
      no_plan: cleanText(formData.no_plan || ''),
      lack_legislation: cleanText(formData.lack_legislation || ''),
      wildlife: cleanText(formData.wildlife || ''),
      children: cleanText(formData.children || ''),
      road_safety: cleanText(formData.road_safety || ''),
      road_infrastructure: cleanText(formData.road_infrastructure || ''),
      lack_engagement: cleanText(formData.lack_engagement || ''),
      decommissioning: cleanText(formData.decommissioning || ''),
      archaeology: cleanText(formData.archaeology || ''),
      flora_fauna: cleanText(formData.flora_fauna || ''),
      privacy: cleanText(formData.privacy || ''),
      visual_impact: cleanText(formData.visual_impact || ''),
      economic_impact: cleanText(formData.economic_impact || ''),
      battery_fire: cleanText(formData.battery_fire || ''),
      property_devaluation: cleanText(formData.property_devaluation || ''),
      agricultural_land: cleanText(formData.agricultural_land || ''),
      additional_concerns: cleanText(formData.additional_concerns || ''),
      personal_story: cleanText(formData.personal_story || '')
    };
    
    // Build committee context based on selected concerns
    const committeeContext = buildCommitteeContext(concerns);
    
    // Build the prompt for Claude
    const prompt = `You are an expert at writing formal planning objection submissions for Irish planning applications following Cork County Council guidelines.

Generate a personalized, professional objection letter to Cork County Council regarding the proposed Inch Solar Development (Greenhills Solar Farm).

RESPONDENT INFORMATION:
Name: ${firstName} ${lastName}
Email: ${email}
Distance from development: ${distance}
Property reference: House ${houseNumber}
Occupation: ${occupation}

PERSONAL CONCERNS PROVIDED BY RESPONDENT:
${Object.entries(concerns)
  .filter(([key, value]) => value && value.length > 0)
  .map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
  .join('\n')}

${committeeContext}

INSTRUCTIONS:
Generate a 500-700 word formal Irish planning objection letter that:

1. Follows the Cork County Council format exactly (as shown in their sample template)
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
   [Grounds for objection - organized by theme]
   [Personal impact]
   [Conclusion requesting refusal]
   
   Mise le Meas,
   ${firstName} ${lastName}

3. Incorporate ONLY the concerns the respondent actually provided (skip empty fields)
4. Weave in relevant committee research naturally where it strengthens the respondent's points
5. Use clear section headings for different concern categories
6. Reference Irish planning guidelines and policies where relevant
7. Maintain professional, respectful tone throughout
8. Include the personal story to strengthen the objection
9. Focus on legitimate planning considerations only
10. Vary the structure and phrasing naturally - use different opening approaches, varied transitions, and alternate between leading with personal impact vs. planning grounds

IMPORTANT: 
- Skip any concern categories where the respondent provided no information
- Make each letter unique in structure and phrasing while maintaining professionalism
- Ensure it sounds human-written, not AI-generated
- Do not include defamatory content or personal grievances
- Focus on planning considerations: impact on amenity, traffic, environment, heritage, community

Generate the complete letter now.`;

    console.log('Calling Claude API...');
    
    // Call Claude API
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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    );
    
    const generatedLetter = claudeResponse.content[0].text;
    console.log('Letter generated successfully');
    
    // Build email body
    const emailBody = `Dear ${firstName},

Thank you for using the Inch Solar Development Submission Generator created by the Inch Killeagh Rural Preservation Group.

Below is your personalized objection letter based on your concerns and incorporating verified facts about the development compiled by our committee.

Please review it carefully, make any personal edits you wish, and submit it to Cork County Council.

================================================================================

${generatedLetter}

================================================================================

HOW TO SUBMIT YOUR OBJECTION:

1. Copy the letter above (or download the attachment if provided)
2. Submit online at: www.corkcoco.ie (preferred method)
   OR send by post to the address shown in the letter
3. You will need to pay a €20 submission fee
4. Ensure you include the planning reference number when it becomes available
5. Submit within 35 days of the planning application being lodged

IMPORTANT NOTES:
- Your submission must include your name and full correspondence address
- Focus on planning considerations only (as shown in the letter)
- You may attach photos, maps, or other supporting documents
- All submissions become public documents

For more information and updates, contact the Inch Killeagh Rural Preservation Group.

In solidarity,
Inch Killeagh Rural Preservation Group`;

    // Send email (placeholder - will implement with Resend or SendGrid)
    // await sendEmail(email, 'Your Personalized Objection - Inch Solar Development', emailBody);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Letter generated successfully',
      letter: generatedLetter,
      email_sent_to: email,
      version: '0.2-draft'
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to generate letter',
      message: error.message
    });
  }
};
