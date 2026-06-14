// Netlify Function to get RSVP counts from form submissions
// This function requires a Netlify access token to read form submissions

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check for API key in environment variable
  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = process.env.NETLIFY_SITE_ID;
  const FORM_NAME = 'rsvp';

  if (!NETLIFY_TOKEN || !SITE_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server configuration missing',
        message: 'NETLIFY_TOKEN and NETLIFY_SITE_ID environment variables must be set'
      }),
    };
  }

  try {
    // Get form submissions from Netlify API
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${SITE_ID}/submissions?form_name=${FORM_NAME}`,
      {
        headers: {
          'Authorization': `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Netlify API error: ${response.status}`);
    }

    const data = await response.json();
    const submissions = data || [];

    // Count responses
    let counts = { oui: 0, peutEtre: 0, non: 0 };

    submissions.forEach(submission => {
      const reponse = submission.data?.reponse || submission.reponse;
      if (reponse === 'oui') counts.oui++;
      else if (reponse === 'peutEtre') counts.peutEtre++;
      else if (reponse === 'non') counts.non++;
    });

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
        total: submissions.length,
        lastUpdated: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error fetching RSVP counts:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch RSVP counts',
        message: error.message,
      }),
    };
  }
};
