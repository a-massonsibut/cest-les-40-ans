# RSVP Setup Guide

## Overview

This repository now includes a **secure RSVP system** that keeps guest responses private and not publicly visible.

## What Changed

1. **New `rsvp.html` page**: A dedicated, secure form page for RSVP responses
2. **Removed client-side storage**: RSVP data is no longer stored in JavaScript variables (which would be visible in the page source)
3. **Netlify Forms integration**: Uses Netlify's secure form handling service
4. **Privacy notice**: Clear explanation that responses are secure and private

## How It Works

### For Guests
- Guests click on the RSVP link in the navigation or main page
- They are taken to `rsvp.html` where they fill out the form
- Form submissions are sent securely via Netlify Forms
- Responses are **NOT** visible on the public website
- Only the site owner (Agnès) can access responses via Netlify's dashboard

### For the Organizer (Agnès)

#### Option 1: Deploy to Netlify (Recommended)

1. **Create a Netlify account** (free) at https://www.netlify.com/
2. **Deploy the site**:
   - Go to Sites → Import from Git
   - Connect your GitHub repository
   - Deploy the site
3. **Access RSVP responses**:
   - Go to your site in Netlify dashboard
   - Click on "Forms" in the left menu
   - All RSVP submissions will appear there
   - You can export responses as CSV

#### Option 2: Use Another Form Service

If you prefer not to use Netlify, you can modify the form in `rsvp.html` to submit to:
- **Google Forms**: Replace the form with a Google Forms embed
- **Formspree**: Change the form action to `https://formspree.io/f/YOUR_FORM_ID`
- **Other services**: Update the form action and method accordingly

## Security Features

✅ **No client-side storage**: RSVP data is not stored in JavaScript variables
✅ **HTTPS encryption**: All form submissions are encrypted in transit
✅ **Private access**: Only you can view responses via Netlify dashboard
✅ **Honeypot protection**: Built-in spam protection
✅ **Security headers**: Additional protection via netlify.toml

## Customization

### Update the Form Fields
Edit `rsvp.html` to modify:
- Questions asked
- Required fields
- Styling to match your theme

### Update Privacy Notice
Modify the privacy notice in `rsvp.html` to reflect your actual data handling practices.

### Update Guest Counter
Since RSVP responses are now private, the guest counter on the main page shows a message that counts are updated manually. You can:
1. Manually update the numbers in `index.html` based on actual responses
2. Or remove the counter entirely if you prefer

## Files Modified

- `index.html`: Removed client-side RSVP form and storage, added link to RSVP page
- `rsvp.html`: New secure RSVP form page
- `netlify.toml`: Configuration for Netlify Forms and security headers
- `RSVP_SETUP.md`: This guide

## Testing

1. Open `rsvp.html` in a browser
2. Fill out the form and submit
3. Check that the form submits successfully
4. Verify responses appear in your Netlify dashboard (if deployed)

## Important Notes

- **Do NOT** add any JavaScript that stores RSVP data in variables
- **Do NOT** display RSVP responses on the public website
- **Always** use HTTPS for your deployed site
- **Regularly** check your Netlify Forms dashboard for new submissions

## Need Help?

If you have questions about setting this up, contact the repository maintainer or check Netlify's documentation:
- Netlify Forms: https://docs.netlify.com/forms/setup/
- Netlify Security: https://docs.netlify.com/security/
