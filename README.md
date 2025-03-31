# Immersive Audio Player

An immersive audio player with XR mode support and automatic track navigation. This player seamlessly transitions between standard audio playback and 360° immersive video experiences.

## Features

- **Immersive XR Mode**: Toggle between standard audio player and 360° immersive video experience
- **Auto-Advance Playback**: Automatically plays the next track when current track ends
- **Track Order Support**: Displays track numbering from CMS data
- **Playlist Support**: Browse and select tracks from the playlist
- **Webflow CMS Integration**: Seamlessly works with Webflow CMS for dynamic content
- **Mobile-Friendly Controls**: Responsive design works on all device sizes
- **Orientation Tracking**: Camera responds to device movement in XR mode

## Installation

### Option 1: Standalone Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/immersive-audio-player.git
```

2. Open the XR-PLAYER.html file in a web browser, or host the files on a web server.

### Option 2: Webflow Integration

1. Upload all JS and CSS files to your Webflow project as assets
2. Create a new Custom Code embed in your Webflow project
3. Copy the contents of XR-PLAYER.html into the embed
4. Update the script and CSS references to point to your uploaded assets

## CMS Integration

The player can be integrated with Webflow CMS by passing the following URL parameters:

| Parameter | Description |
|-----------|-------------|
| `trackName` | Name of the audio track |
| `chapterTitle` | Chapter or section title |
| `audio_src` | URL to the audio file |
| `XR_src` | URL to the 360° video file |
| `albumArt` | URL to the album art image |
| `previousTrackLink` | URL to the previous track in the sequence |
| `nextTrackLink` | URL to the next track in the sequence |
| `trackOrder` | Numerical order of the track in the sequence |
| `autoAdvance` | Set to 'false' to disable auto-advance (default is true) |

## Auto-Advance Functionality

When a track ends, the player will automatically:

1. Check if there's a next track in the playlist manager
2. If not, check if there's a `nextTrackLink` in the CMS data
3. Navigate to the next track page if available

## Example Usage

```html
<iframe 
  src="https://your-player-url.com/XR-PLAYER.html?trackName=My%20Track&chapterTitle=Chapter%201&audio_src=https://example.com/audio.mp3&XR_src=https://example.com/video.mp4&albumArt=https://example.com/image.jpg&trackOrder=1&nextTrackLink=https://example.com/next-track"
  width="100%" 
  height="500" 
  frameborder="0">
</iframe>
```

## Webflow CMS Setup

When setting up the player in Webflow CMS:

1. Create a collection for audio tracks
2. Add fields for track name, chapter title, audio URL, video URL, album art
3. Add number field for track order
4. Add URL fields for previous and next track links
5. In the CMS template, set up links between tracks using Collection Links

## Technical Documentation

The player consists of multiple modules:

- **player-core.js**: Core functionality and track management
- **player-controls.js**: UI controls for playback
- **playlist-manager.js**: Manages playlist data and navigation
- **xr-mode.js**: Handles immersive 360° video experience
- **shared-state.js**: Centralized state management
- **media-preloader.js**: Preloads media content for smooth playback
- **player-layout.css**: Main layout styling
- **player-controls.css**: Control button and UI element styling

## Browser Compatibility

The player is compatible with:
- Chrome 79+
- Firefox 76+
- Safari 13.1+
- Edge 79+
- iOS Safari 13.4+
- Chrome for Android 79+

## Dependencies

- A-Frame 1.4.2+ for the XR experience

## Troubleshooting

If the XR mode doesn't launch:
1. Ensure the video files are served with proper CORS headers
2. Check browser compatibility for WebXR features
3. Verify device has motion/orientation sensors for mobile viewing

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 