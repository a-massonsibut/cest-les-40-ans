// Simple Netlify Function to get RSVP counts from a JSON file
// This version doesn't require API tokens - uses a static JSON file
// that you can update manually or via a form submission webhook

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Read the RSVP data from a JSON file
    // This file should be updated when new submissions come in
    const fs = require('fs');
    const path = require('path');
    
    const dataPath = path.join(__dirname, '..', 'data', 'rsvp-counts.json');
    
    let counts = { oui: 0, peutEtre: 0, non: 0 };
    let lastUpdated = new Date().toISOString();
    
    try {
      const data = fs.readFileSync(dataPath, 'utf8');
      const parsed = JSON.parse(data);
      counts = parsed.counts || counts;
      lastUpdated = parsed.lastUpdated || lastUpdated;
    } catch (err) {
      // File doesn't exist yet, use defaults
      console.log('No RSVP data file found, using defaults');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        counts: counts,
        total: counts.oui + counts.peutEtre + counts.non,
        lastUpdated: lastUpdated,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch RSVP counts',
        message: error.message,
      }),
    };
  }
};
