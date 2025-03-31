/**
 * Playlist Manager - Manages playlist and track navigation
 * This module handles the playlist data and provides methods
 * for navigating between tracks.
 */
const PlaylistManager = (function() {
  // Default playlist
  let playlist = {
    tracks: [
      {
        id: 1,
        title: "SoundHelix Demo Track",
        chapter: "Chapter 1: Open Skies",
        audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        videoSrc: "https://cdn.glitch.global/6cb26b61-85d5-4e11-8c27-4e6a20f40e0b/360video.mp4?v=1695175536251",
        albumArt: "https://upload.wikimedia.org/wikipedia/en/7/74/Radiohead.okcomputer.albumart.jpg"
      },
      {
        id: 2,
        title: "SoundHelix Demo Track 2",
        chapter: "Chapter 2: Deep Forest",
        audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        videoSrc: "https://cdn.glitch.global/6cb26b61-85d5-4e11-8c27-4e6a20f40e0b/360video.mp4?v=1695175536251",
        albumArt: "https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/Dark_Side_of_the_Moon.png/220px-Dark_Side_of_the_Moon.png"
      },
      {
        id: 3,
        title: "SoundHelix Demo Track 3",
        chapter: "Chapter 3: Mountain View",
        audioSrc: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        videoSrc: "https://cdn.glitch.global/6cb26b61-85d5-4e11-8c27-4e6a20f40e0b/360video.mp4?v=1695175536251",
        albumArt: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/Pink_Floyd%2C_Wish_You_Were_Here_%281975%29.png/220px-Pink_Floyd%2C_Wish_You_Were_Here_%281975%29.png"
      }
    ],
    currentIndex: 0
  };
  
  // Custom callbacks for CMS integration
  let customPreviousCallback = null;
  let customNextCallback = null;
  
  // Initialize the playlist manager
  function init(customPlaylist) {
    if (customPlaylist) {
      playlist = customPlaylist;
    }
    
    // Update shared state if available
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({
        playlist: playlist
      });
    }
    
    // Check if auto-advance is disabled in URL
    const urlParams = new URLSearchParams(window.location.search);
    const autoAdvance = urlParams.get('autoAdvance') !== 'false'; // Default to true
    
    // Update shared state with autoAdvance setting
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({
        autoAdvance: autoAdvance
      });
      console.log(`Auto-advance setting: ${autoAdvance}`);
    }
    
    // Load first track if PlayerCore is available
    if (typeof PlayerCore !== 'undefined' && playlist.tracks.length > 0) {
      PlayerCore.loadTrack(playlist.tracks[playlist.currentIndex]);
    }
  }
  
  // Load playlist from JSON URL
  function loadPlaylistFromUrl(url) {
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        playlist = data;
        playlist.currentIndex = 0;
        
        // Update shared state if available
        if (typeof SharedState !== 'undefined') {
          SharedState.updateState({
            playlist: playlist
          });
        }
        
        // Load first track if PlayerCore is available
        if (typeof PlayerCore !== 'undefined' && playlist.tracks.length > 0) {
          PlayerCore.loadTrack(playlist.tracks[playlist.currentIndex]);
        }
        
        return playlist;
      })
      .catch(error => {
        console.error('Error loading playlist:', error);
        
        // Log to shared state if available
        if (typeof SharedState !== 'undefined') {
          SharedState.logError({
            message: 'Error loading playlist',
            details: error.message
          });
        }
      });
  }
  
  // Get current track
  function getCurrentTrack() {
    if (playlist.tracks.length === 0) {
      return null;
    }
    return playlist.tracks[playlist.currentIndex];
  }
  
  // Go to next track
  function next() {
    if (playlist.tracks.length === 0) {
      return null;
    }
    
    // If custom next callback is set, use it
    if (customNextCallback) {
      customNextCallback();
      return getCurrentTrack();
    }
    
    // Increment index with wraparound
    playlist.currentIndex = (playlist.currentIndex + 1) % playlist.tracks.length;
    
    // Update shared state if available
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({
        playlist: {
          ...playlist
        }
      });
    }
    
    // Load the track if PlayerCore is available
    const nextTrack = playlist.tracks[playlist.currentIndex];
    if (typeof PlayerCore !== 'undefined') {
      PlayerCore.loadTrack(nextTrack);
    }
    
    return nextTrack;
  }
  
  // Go to previous track
  function previous() {
    if (playlist.tracks.length === 0) {
      return null;
    }
    
    // If custom previous callback is set, use it
    if (customPreviousCallback) {
      customPreviousCallback();
      return getCurrentTrack();
    }
    
    // Decrement index with wraparound
    playlist.currentIndex = (playlist.currentIndex - 1 + playlist.tracks.length) % playlist.tracks.length;
    
    // Update shared state if available
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({
        playlist: {
          ...playlist
        }
      });
    }
    
    // Load the track if PlayerCore is available
    const prevTrack = playlist.tracks[playlist.currentIndex];
    if (typeof PlayerCore !== 'undefined') {
      PlayerCore.loadTrack(prevTrack);
    }
    
    return prevTrack;
  }
  
  // Set a custom callback for previous track navigation (for CMS integration)
  function setPreviousCallback(callback) {
    if (typeof callback === 'function') {
      customPreviousCallback = callback;
    }
  }
  
  // Set a custom callback for next track navigation (for CMS integration)
  function setNextCallback(callback) {
    if (typeof callback === 'function') {
      customNextCallback = callback;
    }
  }
  
  // Clear custom callbacks
  function clearCustomCallbacks() {
    customPreviousCallback = null;
    customNextCallback = null;
  }
  
  // Check if there's a next track available
  function hasNextTrack() {
    return customNextCallback !== null || playlist.tracks.length > 1;
  }
  
  // Check if there's a previous track available
  function hasPreviousTrack() {
    return customPreviousCallback !== null || playlist.tracks.length > 1;
  }
  
  // Jump to specific track by index
  function jumpTo(index) {
    if (playlist.tracks.length === 0 || index < 0 || index >= playlist.tracks.length) {
      return null;
    }
    
    // Exit XR mode if active before loading a new track from playlist
    if (typeof XRController !== 'undefined' && XRController.isInXRMode()) {
      console.log('Exiting XR mode when selecting track from playlist');
      XRController.exitXRMode();
    }
    
    playlist.currentIndex = index;
    
    // Update shared state if available
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({
        playlist: {
          ...playlist
        }
      });
    }
    
    // Load the track if PlayerCore is available
    const track = playlist.tracks[playlist.currentIndex];
    if (typeof PlayerCore !== 'undefined') {
      PlayerCore.loadTrack(track);
    }
    
    return track;
  }
  
  // Search tracks by title (simple implementation)
  function searchTracks(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }
    
    const lowerQuery = query.toLowerCase();
    return playlist.tracks.filter(track => 
      track.title.toLowerCase().includes(lowerQuery) || 
      track.chapter.toLowerCase().includes(lowerQuery)
    );
  }
  
  // Public API
  return {
    init,
    loadPlaylistFromUrl,
    getCurrentTrack,
    next,
    previous,
    jumpTo,
    searchTracks,
    getPlaylist: () => ({ ...playlist }),
    getTrackCount: () => playlist.tracks.length,
    getCurrentIndex: () => playlist.currentIndex,
    setPreviousCallback,
    setNextCallback,
    clearCustomCallbacks,
    hasNextTrack,
    hasPreviousTrack
  };
})(); 