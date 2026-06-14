// Netlify Function to update RSVP counts when a new submission comes in
// This is triggered by a Netlify form submission webhook

exports.handler = async (event, context) => {
  // Only allow POST requests (from Netlify webhook)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const fs = require('fs');
    const path = require('path');
    
    // Get the submission data from the webhook
    const body = JSON.parse(event.body);
    const data = body.data || body;
    
    // Check if this is an RSVP form submission
    if (body.form_name !== 'rsvp' && data.form_name !== 'rsvp') {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Not an RSVP form, skipping' }),
      };
    }

    // Read current counts
    const dataPath = path.join(__dirname, '..', 'data', 'rsvp-counts.json');
    let counts = { oui: 0, peutEtre: 0, non: 0 };
    
    try {
      const fileData = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(fileData);
      counts = parsed.counts || counts;
    } catch (err) {
      // File doesn't exist yet, use defaults
    }

    // Update counts based on the new submission
    const reponse = data.reponse || data.data?.reponse;
    if (reponse === 'oui') counts.oui++;
    else if (reponse === 'peutEtre') counts.peutEtre++;
    else if (reponse === 'non') counts.non++;

    // Save updated counts
    const updatedData = {
      counts: counts,
      total: counts.oui + counts.peutEtre + counts.non,
      lastUpdated: new Date().toISOString(),
    };

    fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2), 'utf8');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'RSVP counts updated',
        counts: counts,
      }),
    };
  } catch (error) {
    console.error('Error updating RSVP counts:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to update RSVP counts',
        message: error.message,
      }),
    };
  }
};
