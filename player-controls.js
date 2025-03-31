/**
 * Player Controls - Manages the audio player UI controls
 * This module handles the play/pause, seek, rewind, forward and volume controls
 * for the audio player.
 */
const PlayerControls = (function() {
  // DOM elements
  const audio = document.querySelector('#audio');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const rewindBtn = document.getElementById('rewind-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const muteBtn = document.getElementById('mute-btn');
  const playIcon = document.querySelector('.play-icon');
  const pauseIcon = document.querySelector('.pause-icon');
  const volumeIcon = document.querySelector('.volume-icon');
  const muteIcon = document.querySelector('.mute-icon');
  const progressBar = document.querySelector('.progress-bar');
  const progressFilled = document.querySelector('.progress-filled');
  const currentTimeDisplay = document.getElementById('current-time');
  const durationDisplay = document.getElementById('duration');
  const playerContainer = document.getElementById('player-container');
  const playlistBtn = document.getElementById('playlist-btn');
  const playlistOverlay = document.getElementById('playlist-overlay');
  const closePlaylistBtn = document.getElementById('close-playlist-btn');
  const playlistTracks = document.getElementById('playlist-tracks');
  
  // Constants
  const TIME_SKIP_SECONDS = 10;
  const DEFAULT_VOLUME = 1.0;
  
  // State
  let isMuted = false;
  let lastVolume = DEFAULT_VOLUME;
  let isDragging = false;
  
  // Initialize the controls
  function init() {
    if (!audio || !playPauseBtn || !progressBar || !muteBtn) {
      console.error('Player Controls: Required DOM elements not found');
      return;
    }
    
    // Add event listeners for player controls
    playPauseBtn.addEventListener('click', togglePlay);
    
    // Enhanced scrubbing controls for both mouse and touch
    progressBar.addEventListener('click', seekToPosition);
    progressBar.addEventListener('mousedown', startDrag);
    progressBar.addEventListener('touchstart', startDrag, { passive: false });
    
    muteBtn.addEventListener('click', toggleMute);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', updatePlayPauseUI);
    audio.addEventListener('pause', updatePlayPauseUI);
    
    // Add ended event listener to handle auto-advance
    audio.addEventListener('ended', handleTrackEnded);
    
    // Add time skip controls
    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => skipTime(-TIME_SKIP_SECONDS));
    }
    
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => skipTime(TIME_SKIP_SECONDS));
    }
    
    // Add playlist controls
    if (playlistBtn) {
      playlistBtn.addEventListener('click', togglePlaylistOverlay);
    }
    
    if (closePlaylistBtn) {
      closePlaylistBtn.addEventListener('click', hidePlaylistOverlay);
    }
    
    // Initialize playlist if PlaylistManager is available
    if (typeof PlaylistManager !== 'undefined') {
      renderPlaylist();
      
      // Subscribe to playlist changes if SharedState is available
      if (typeof SharedState !== 'undefined') {
        SharedState.subscribe('playlistChanged', () => {
          renderPlaylist();
        });
        
        SharedState.subscribe('currentTrackChanged', () => {
          updatePlaylistHighlight();
        });
      }
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Sync with SharedState if available
    if (typeof SharedState !== 'undefined') {
      // Listen for state changes
      SharedState.subscribe('isPlayingChanged', (isPlaying) => {
        if (isPlaying !== !audio.paused) {
          togglePlay();
        }
      });
      
      SharedState.subscribe('isMutedChanged', (muted) => {
        if (muted !== isMuted) {
          toggleMute();
        }
      });
      
      SharedState.subscribe('currentTimeChanged', (time) => {
        if (Math.abs(audio.currentTime - time) > 1) {
          audio.currentTime = time;
        }
      });
    }
    
    // Initialize volume
    audio.volume = DEFAULT_VOLUME;
  }
  
  // Toggle playlist overlay visibility
  function togglePlaylistOverlay() {
    if (playlistOverlay.classList.contains('active')) {
      hidePlaylistOverlay();
    } else {
      showPlaylistOverlay();
    }
  }
  
  // Show playlist overlay
  function showPlaylistOverlay() {
    playlistOverlay.classList.add('active');
    renderPlaylist(); // Ensure playlist is updated
  }
  
  // Hide playlist overlay
  function hidePlaylistOverlay() {
    playlistOverlay.classList.remove('active');
  }
  
  // Render playlist tracks
  function renderPlaylist() {
    if (!playlistTracks || typeof PlaylistManager === 'undefined') return;
    
    // Clear existing tracks
    playlistTracks.innerHTML = '';
    
    // Get playlist and current index
    const playlist = PlaylistManager.getPlaylist();
    const currentIndex = PlaylistManager.getCurrentIndex();
    
    // Create track elements
    playlist.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.dataset.index = index;
      li.classList.toggle('active', index === currentIndex);
      
      // Create track title element
      const titleElement = document.createElement('div');
      titleElement.className = 'track-title';
      titleElement.textContent = track.title;
      
      // Create track chapter element
      const chapterElement = document.createElement('div');
      chapterElement.className = 'track-chapter';
      chapterElement.textContent = track.chapter;
      
      // Add elements to list item
      li.appendChild(titleElement);
      li.appendChild(chapterElement);
      
      // Add click handler
      li.addEventListener('click', () => {
        PlaylistManager.jumpTo(index);
        hidePlaylistOverlay();
      });
      
      // Add to playlist
      playlistTracks.appendChild(li);
    });
  }
  
  // Update playlist highlight for current track
  function updatePlaylistHighlight() {
    if (!playlistTracks) return;
    
    // Remove active class from all tracks
    const tracks = playlistTracks.querySelectorAll('li');
    tracks.forEach(track => track.classList.remove('active'));
    
    // Add active class to current track
    const currentIndex = PlaylistManager.getCurrentIndex();
    const currentTrack = playlistTracks.querySelector(`li[data-index="${currentIndex}"]`);
    if (currentTrack) {
      currentTrack.classList.add('active');
    }
  }
  
  // Toggle play/pause
  function togglePlay() {
    if (audio.paused) {
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        if (typeof SharedState !== 'undefined') {
          SharedState.logError(error);
        }
      });
    } else {
      audio.pause();
    }
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ isPlaying: !audio.paused });
    }
  }
  
  // Toggle mute
  function toggleMute() {
    // Check if we're in XR mode and use the master mute if available
    if (typeof XRController !== 'undefined' && XRController.isInXRMode()) {
      // Use XRController's master mute function
      const newMuteState = XRController.toggleMasterMute();
      
      // Update UI based on the returned state
      updateMuteUI(newMuteState);
      console.log('Toggled mute in XR mode. New state:', newMuteState);
      return;
    }
    
    // Standard audio-only mode mute behavior
    if (isMuted) {
      // Unmute - restore previous volume
      audio.volume = lastVolume;
      isMuted = false;
    } else {
      // Mute - save current volume and set to 0
      lastVolume = audio.volume;
      audio.volume = 0;
      isMuted = true;
    }
    
    // Update UI
    updateMuteUI(isMuted);
    console.log('Toggled mute in audio-only mode. New state:', isMuted);
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        isMuted: isMuted,
        volume: audio.volume
      });
    }
  }
  
  // Update mute button UI
  function updateMuteUI(isMuted) {
    if (isMuted) {
      muteBtn.classList.add('muted');
      volumeIcon.style.display = 'none';
      muteIcon.style.display = 'block';
    } else {
      muteBtn.classList.remove('muted');
      volumeIcon.style.display = 'block';
      muteIcon.style.display = 'none';
    }
  }
  
  // Skip time forward or backward
  function skipTime(seconds) {
    if (!audio) return;
    
    // Calculate new time
    const newTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    
    // Apply new time
    audio.currentTime = newTime;
    
    // Show visual feedback (optional)
    const feedbackElement = seconds < 0 ? rewindBtn : forwardBtn;
    if (feedbackElement) {
      feedbackElement.classList.add('active');
      setTimeout(() => feedbackElement.classList.remove('active'), 200);
    }
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        currentTime: audio.currentTime
      });
    }
    
    // If XRController is available, sync the video time
    if (typeof XRController !== 'undefined' && XRController.isInXRMode()) {
      const videoElement = document.querySelector('#xr-video');
      if (videoElement) {
        videoElement.currentTime = audio.currentTime;
      }
    }
  }
  
  // Start dragging on progress bar
  function startDrag(event) {
    event.preventDefault(); // Prevent default browser behavior
    
    // Mark that we're dragging
    isDragging = true;
    progressBar.classList.add('scrubbing');
    
    // Store audio playing state for resuming later
    const wasPlaying = !audio.paused;
    if (wasPlaying) {
      audio.pause(); // Pause during scrubbing for better control
    }
    
    // Store the state for later
    progressBar.dataset.wasPlaying = wasPlaying;
    
    // Update position immediately
    updateSeekPosition(event);
    
    // Add move and end event listeners
    document.addEventListener('mousemove', updateSeekPosition);
    document.addEventListener('touchmove', updateSeekPosition, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
  }
  
  // Update position during drag
  function updateSeekPosition(event) {
    if (!isDragging) return;
    
    // Prevent default scrolling on touch devices
    if (event.type === 'touchmove') {
      event.preventDefault();
    }
    
    // Get the appropriate clientX value based on event type
    const clientX = event.type.includes('touch') 
      ? event.touches[0].clientX 
      : event.clientX;
    
    // Get progress bar bounds
    const rect = progressBar.getBoundingClientRect();
    
    // Calculate position within bounds (0 to 1)
    let seekPos = (clientX - rect.left) / rect.width;
    seekPos = Math.max(0, Math.min(1, seekPos)); // Clamp between 0 and 1
    
    // Update UI
    progressFilled.style.width = `${seekPos * 100}%`;
    
    // Update time display but don't seek yet for smoother UX
    currentTimeDisplay.textContent = formatTime(seekPos * audio.duration);
    
    // Add a class to the document body to prevent text selection during dragging
    document.body.classList.add('scrubbing-in-progress');
  }
  
  // End dragging and apply final position
  function endDrag(event) {
    if (!isDragging) return;
    
    // Get the appropriate clientX value based on event type
    const clientX = event.type.includes('touch') 
      ? (event.changedTouches ? event.changedTouches[0].clientX : 0) 
      : event.clientX;
    
    // Get progress bar bounds  
    const rect = progressBar.getBoundingClientRect();
    
    // Calculate position within bounds (0 to 1)
    let seekPos = (clientX - rect.left) / rect.width;
    seekPos = Math.max(0, Math.min(1, seekPos)); // Clamp between 0 and 1
    
    // Apply final position
    audio.currentTime = seekPos * audio.duration;
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        currentTime: audio.currentTime
      });
    }
    
    // Reset dragging state
    isDragging = false;
    progressBar.classList.remove('scrubbing');
    document.body.classList.remove('scrubbing-in-progress');
    
    // Resume playback if it was playing before
    if (progressBar.dataset.wasPlaying === 'true') {
      audio.play().catch(error => {
        console.error('Error resuming playback:', error);
      });
    }
    delete progressBar.dataset.wasPlaying;
    
    // Clean up event listeners
    document.removeEventListener('mousemove', updateSeekPosition);
    document.removeEventListener('touchmove', updateSeekPosition);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);
    document.removeEventListener('touchcancel', endDrag);
  }
  
  // Handle clicks on the progress bar to seek (for non-drag interactions)
  function seekToPosition(event) {
    // Skip if this was the end of a drag
    if (isDragging) return;
    
    const rect = progressBar.getBoundingClientRect();
    const clientX = event.type.includes('touch') 
      ? event.touches[0].clientX 
      : event.clientX;
    
    const seekPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = seekPos * audio.duration;
    
    // Provide visual feedback
    progressBar.classList.add('scrubbing');
    setTimeout(() => {
      progressBar.classList.remove('scrubbing');
    }, 150);
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        currentTime: audio.currentTime
      });
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeyboardShortcuts(event) {
    // Only process if not in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch (event.key) {
      case ' ':  // Spacebar
      case 'k':  // YouTube-style shortcut
        event.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
      case 'j':  // YouTube-style shortcut
        event.preventDefault();
        skipTime(-TIME_SKIP_SECONDS);
        break;
      case 'ArrowRight':
      case 'l':  // YouTube-style shortcut
        event.preventDefault();
        skipTime(TIME_SKIP_SECONDS);
        break;
      case 'm':  // Mute
        event.preventDefault();
        toggleMute();
        break;
    }
  }
  
  // Update the play/pause button UI based on play state
  function updatePlayPauseUI() {
    if (audio.paused) {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    } else {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    }
  }
  
  // Update progress bar and time display
  function updateProgress() {
    // Skip updates while dragging for smoother UX
    if (isDragging) return;
    
    const percent = (audio.currentTime / audio.duration) * 100;
    progressFilled.style.width = `${percent}%`;
    
    // Update current time display
    currentTimeDisplay.textContent = formatTime(audio.currentTime);
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        currentTime: audio.currentTime
      });
    }
  }
  
  // Update duration display when metadata is loaded
  function updateDuration() {
    durationDisplay.textContent = formatTime(audio.duration);
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        duration: audio.duration
      });
    }
  }
  
  // Format time in MM:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60) || 0;
    const secs = Math.floor(seconds % 60) || 0;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  
  // Handle end of track
  function handleTrackEnded() {
    console.log('Track ended in PlayerControls');
    
    // Update UI to show paused state
    updatePlayPauseUI();
    
    // Reset progress position
    updateProgress();
    
    // If PlayerCore is available, let it handle the track ended logic
    if (typeof PlayerCore !== 'undefined' && typeof PlayerCore.handleTrackEnded === 'function') {
      PlayerCore.handleTrackEnded();
    } else {
      console.log('PlayerCore not available, handling track end locally');
      
      // Check if PlaylistManager is available
      if (typeof PlaylistManager !== 'undefined' && PlaylistManager.hasNextTrack()) {
        // Play next track in playlist
        PlaylistManager.next();
      } else {
        // Check URL parameters for auto-advance setting
        const urlParams = new URLSearchParams(window.location.search);
        const nextTrackLink = urlParams.get('nextTrackLink');
        
        // If nextTrackLink is available, navigate to it
        if (nextTrackLink) {
          console.log('Navigating to next track:', nextTrackLink);
          window.location.href = nextTrackLink;
        }
      }
    }
  }
  
  // Public API
  return {
    init,
    togglePlay,
    toggleMute,
    skipTime,
    formatTime
  };
})(); 