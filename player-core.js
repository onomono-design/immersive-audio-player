/**
 * Player Core - Manages the main audio player functionality
 * This module handles the core player logic, track loading,
 * and initialization.
 */
const PlayerCore = (function() {
  // DOM elements
  const audioElement = document.querySelector('#audio');
  const audioSrc = document.querySelector('#audio-src');
  const videoElement = document.querySelector('#xr-video');
  const albumArt = document.querySelector('#album-art');
  const trackName = document.querySelector('#track-name');
  const chapterName = document.querySelector('#chapter-name');
  
  // State
  let currentTrack = null;
  let cmsData = null;
  
  // Initialize the player
  function init(initialTrack) {
    // Check if required elements exist
    if (!audioElement || !audioSrc || !videoElement) {
      console.error('Player Core: Required DOM elements not found');
      return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial track if provided
    if (initialTrack) {
      loadTrack(initialTrack);
    }
    
    // Check for CMS data in the URL on initial load
    checkForCmsDataInUrl();
    
    // Initialize other components if available
    if (typeof PlayerControls !== 'undefined') {
      PlayerControls.init();
    }
    
    if (typeof XRController !== 'undefined') {
      XRController.init();
    }
    
    // Notify SharedState that player is initialized
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        isPlayerInitialized: true
      });
    }
  }
  
  // Setup player event listeners
  function setupEventListeners() {
    // Add media event listeners
    audioElement.addEventListener('play', updatePlayState);
    audioElement.addEventListener('pause', updatePlayState);
    audioElement.addEventListener('ended', handleTrackEnded);
    audioElement.addEventListener('error', handleMediaError);
    
    videoElement.addEventListener('error', handleMediaError);
  }
  
  // Check for CMS data in URL parameters
  function checkForCmsDataInUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check if CMS data is present in URL
      if (urlParams.has('cmsData')) {
        // Try to parse the JSON data from the URL
        const cmsDataParam = urlParams.get('cmsData');
        const parsedData = JSON.parse(decodeURIComponent(cmsDataParam));
        
        // Load track from CMS data
        loadTrackFromCmsData(parsedData);
      } else {
        // Check for individual URL parameters for backward compatibility
        const trackFields = {
          trackName: urlParams.get('trackName'),
          chapterTitle: urlParams.get('chapterTitle'),
          audio_src: urlParams.get('audio_src'),
          XR_src: urlParams.get('XR_src'),
          albumArt: urlParams.get('albumArt'),
          previousTrackLink: urlParams.get('previousTrackLink'),
          nextTrackLink: urlParams.get('nextTrackLink'),
          trackOrder: urlParams.get('trackOrder')
        };
        
        // If we have at least audio source, we can load the track
        if (trackFields.audio_src) {
          // Convert trackOrder to number if present
          if (trackFields.trackOrder) {
            trackFields.trackOrder = parseInt(trackFields.trackOrder, 10) || 0;
          }
          
          loadTrackFromCmsData(trackFields);
        }
      }
    } catch (error) {
      console.error('Error parsing CMS data from URL:', error);
      if (typeof SharedState !== 'undefined') {
        SharedState.logError({
          message: 'Error parsing CMS data from URL',
          details: error.message
        });
      }
    }
  }
  
  // Load track from CMS data
  function loadTrackFromCmsData(data) {
    if (!data) return;
    
    // Store CMS data
    cmsData = data;
    
    // Create track object from CMS data
    const track = {
      title: data.trackName || 'Unknown Track',
      chapter: data.chapterTitle || '',
      audioSrc: data.audio_src || '',
      videoSrc: data.XR_src || '',
      albumArt: data.albumArt || '',
      previousTrackLink: data.previousTrackLink || null,
      nextTrackLink: data.nextTrackLink || null,
      trackOrder: data.trackOrder || 0,
      isXR: data.isXR === true
    };
    
    // Load the track
    loadTrack(track);
    
    // Update shared state with CMS data
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        cmsData: cmsData 
      });
    }
  }
  
  // Load a new track into the player
  function loadTrack(track) {
    if (!track || !track.audioSrc) {
      console.error('Player Core: Invalid track object');
      return;
    }
    
    // Update current track
    currentTrack = track;
    
    // Show loading indicator if available
    if (typeof MediaPreloader !== 'undefined') {
      MediaPreloader.showLoading();
    }
    
    // Update audio source
    audioSrc.src = track.audioSrc;
    audioElement.load();
    
    // Update video source if available
    if (track.videoSrc && videoElement) {
      videoElement.src = track.videoSrc;
      videoElement.load();
    }
    
    // Update UI elements
    updateTrackInfo(track);
    
    // Check if we were playing before loading this track (for auto-advance)
    const wasPlaying = !audioElement.paused;
    
    // Listen for when media is ready to play
    audioElement.addEventListener('canplaythrough', function onCanPlay() {
      audioElement.removeEventListener('canplaythrough', onCanPlay);
      
      // Hide loading indicator if available
      if (typeof MediaPreloader !== 'undefined') {
        MediaPreloader.hideLoading();
      }
      
      // Auto-play if we were previously playing (for auto-advancement)
      if (wasPlaying) {
        console.log('Auto-playing next track');
        audioElement.play().catch(e => console.error('Auto-play prevented:', e));
      }
      
      // Update shared state
      if (typeof SharedState !== 'undefined') {
        SharedState.updateState({ 
          currentTrack: track,
          duration: audioElement.duration,
          isTrackLoaded: true,
          audioBuffered: true
        });
      }
    }, { once: true });
  }
  
  // Update track display information
  function updateTrackInfo(track) {
    if (!track) return;
    
    // Update track name and chapter
    if (trackName) {
      // If track has a track order, display it in the title
      if (track.trackOrder) {
        trackName.textContent = `${track.trackOrder}. ${track.title || 'Unknown Track'}`;
      } else {
        trackName.textContent = track.title || 'Unknown Track';
      }
    }
    
    if (chapterName) chapterName.textContent = track.chapter || '';
    
    // Update album art
    if (albumArt && track.albumArt) {
      albumArt.src = track.albumArt;
      albumArt.alt = track.title || 'Album Artwork';
    }
    
    // Update navigation buttons if track has CMS navigation links
    if (track.previousTrackLink || track.nextTrackLink) {
      setupCmsNavigationButtons(track);
    }
    
    // Update document title to include track info
    document.title = `${track.trackOrder ? track.trackOrder + '. ' : ''}${track.title || 'Audio Player'}`;
  }
  
  // Set up navigation for CMS-based tracks
  function setupCmsNavigationButtons(track) {
    // If integrated with a CMS, previous/next buttons could navigate to different pages
    // This can be implemented when we know the specific CMS integration details
    if (track.previousTrackLink) {
      // Example: Set up previous track navigation to another CMS item
      if (typeof PlaylistManager !== 'undefined') {
        // Override the default previous behavior for CMS integration
        PlaylistManager.setPreviousCallback(() => {
          window.location.href = track.previousTrackLink;
        });
      }
    }
    
    if (track.nextTrackLink) {
      // Example: Set up next track navigation to another CMS item
      if (typeof PlaylistManager !== 'undefined') {
        // Override the default next behavior for CMS integration
        PlaylistManager.setNextCallback(() => {
          window.location.href = track.nextTrackLink;
        });
      }
    }
  }
  
  // Handle track end
  function handleTrackEnded() {
    console.log('Track ended, checking for next track...');
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        isPlaying: false,
        isTrackEnded: true
      });
    }
    
    // Check if auto-advance is enabled
    let autoAdvance = true;
    if (typeof SharedState !== 'undefined') {
      const state = SharedState.getState();
      if (state && state.autoAdvance !== undefined) {
        autoAdvance = state.autoAdvance;
      }
    }
    
    // Only auto-advance if the setting is enabled
    if (!autoAdvance) {
      console.log('Auto-advance is disabled, not advancing to next track');
      return;
    }
    
    // Auto-play next track if available
    if (typeof PlaylistManager !== 'undefined' && PlaylistManager.hasNextTrack()) {
      console.log('Auto-playing next track from playlist');
      
      // Always exit XR mode when moving to next track
      if (typeof XRController !== 'undefined' && XRController.isInXRMode()) {
        console.log('Exiting XR mode before advancing to next track');
        XRController.exitXRMode();
      }
      
      // Play the next track
      PlaylistManager.next();
    } else if (currentTrack && currentTrack.nextTrackLink) {
      // If we're using CMS links, automatically navigate to next track
      console.log(`Track ${currentTrack.trackOrder} ended. Navigating to next track: ${currentTrack.nextTrackLink}`);
      
      // Always exit XR mode when moving to next track via CMS
      if (typeof XRController !== 'undefined' && XRController.isInXRMode()) {
        console.log('Exiting XR mode before navigating to next track');
        XRController.exitXRMode();
      }
      
      // Navigate to the next track
      window.location.href = currentTrack.nextTrackLink;
    } else {
      console.log('No next track available');
    }
  }
  
  // Update play state in shared state
  function updatePlayState() {
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        isPlaying: !audioElement.paused
      });
    }
  }
  
  // Handle media errors
  function handleMediaError(event) {
    const errorElement = event.target;
    let errorDetails = {};
    
    if (errorElement.error) {
      switch (errorElement.error.code) {
        case 1: // MEDIA_ERR_ABORTED
          errorDetails = { code: 1, message: 'Media playback aborted by user' };
          break;
        case 2: // MEDIA_ERR_NETWORK
          errorDetails = { code: 2, message: 'Network error during media download' };
          break;
        case 3: // MEDIA_ERR_DECODE
          errorDetails = { code: 3, message: 'Media decoding error' };
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          errorDetails = { code: 4, message: 'Media format not supported' };
          break;
        default:
          errorDetails = { code: 0, message: 'Unknown media error' };
      }
    } else {
      errorDetails = { code: 0, message: 'Unknown media error' };
    }
    
    console.error(`Media Error (${errorElement.tagName}):`, errorDetails.message);
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.logError({
        source: errorElement.tagName.toLowerCase() === 'audio' ? 'audio' : 'video',
        details: errorDetails
      });
    }
    
    // Hide loading indicator if it's still showing
    if (typeof MediaPreloader !== 'undefined') {
      MediaPreloader.hideLoading();
    }
  }
  
  // Get current track info
  function getCurrentTrack() {
    return currentTrack;
  }
  
  // Get CMS data if available
  function getCmsData() {
    return cmsData;
  }
  
  // Public API
  return {
    init,
    loadTrack,
    loadTrackFromCmsData,
    handleTrackEnded,
    getCurrentTrack,
    getCmsData
  };
})(); 