# Immersive Audio Player CMS Integration Guide

This guide explains how to integrate the immersive audio player into your Webflow CMS (or other CMS platforms) using iframes and the postMessage API for xrwalkingtour.com.

## Integration Overview

The integration works by:
1. Embedding the player in an iframe on your CMS page template
2. Passing data from the CMS to the player using the postMessage API
3. Allowing the player to access the current CMS item's content

## Step 1: Deploy the Player

1. The player is deployed at https://mediaplayer-tau.vercel.app
2. This deployment allows iframe embedding from xrwalkingtour.com domains

## Step 2: Add the Embed Code to Your CMS Template

### For Webflow

1. In your Webflow project, go to the Collection Page template for your audio tracks
2. Add an "Embed" element where you want the player to appear
3. Paste the code from `webflow-embed.html` into the embed element
4. The iframe is already configured to point to the player URL:

```html
<iframe 
  id="immersive-player-iframe"
  class="immersive-player-iframe"
  src="https://mediaplayer-tau.vercel.app" 
  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
  allowfullscreen
  loading="lazy">
</iframe>
```

## Step 3: Set Up CMS Collection Fields

Ensure your xrwalkingtour.com Webflow collection has these fields:

| Field Name      | Type          | Description                           |
|-----------------|---------------|---------------------------------------|
| name            | Text          | Track title                           |
| chapterTitle    | Text          | Chapter or section name               |
| audioUrl        | Link/URL      | URL to the audio file                 |
| xrUrl           | Link/URL      | URL to the 360° video file            |
| albumArtUrl     | Image/URL     | URL to the album art image            |
| trackNumber     | Number        | Numerical order in playlist           |
| isXR            | Boolean       | Whether this track has 360° content   |

## Step 4: Set Up Navigation Links (Optional)

To enable playlist navigation between tracks:

1. Add "Next" and "Previous" link elements to your CMS template
2. Give them the IDs `next-track-link` and `prev-track-link`
3. Configure them to link to the next/previous items in your collection

```html
<a id="prev-track-link" href="{{wf {&quot;path&quot;:&quot;previous-item-url&quot;} }}">Previous</a>
<a id="next-track-link" href="{{wf {&quot;path&quot;:&quot;next-item-url&quot;} }}">Next</a>
```

## Step 5: Security and Domain Configuration

The player is configured to only accept messages from:
- https://xrwalkingtour.com
- Any subdomain of xrwalkingtour.com
- localhost (for development)

If you need to add additional domains, contact the administrator to update the allowed origins.

## Step 6: Test the Integration

1. Publish your Webflow site
2. Navigate to a collection item page with the embedded player
3. Check browser console to verify communication between the page and iframe
4. Verify that the player displays the correct content from the CMS item

## Troubleshooting

### Player Not Receiving CMS Data

1. Check browser console for errors
2. Verify that the Webflow page is properly published
3. Ensure you're accessing the site from an allowed origin (xrwalkingtour.com)
4. Check that your CMS fields match the expected field names

### Cross-Origin Issues

If you see cross-origin (CORS) errors in the console:
1. Verify you're accessing the site from xrwalkingtour.com domain
2. Check that the player is being loaded from https://mediaplayer-tau.vercel.app
3. Ensure no third-party browser extensions are blocking the communication

### Mobile Device Support

For optimal mobile experience:
1. Ensure your Webflow site has proper viewport settings
2. Test on various devices to verify orientation sensors work properly
3. iOS requires user interaction before enabling device orientation sensors

## Custom Implementations

For other CMS platforms, adapt the embed code to work with your platform's API for accessing CMS data. 