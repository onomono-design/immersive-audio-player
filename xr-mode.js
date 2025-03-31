/**
 * XR Mode Controller - Handles XR-specific functionality
 * This module manages toggling between regular audio mode and
 * immersive XR mode with 360° video.
 */
const XRController = (function() {
  // DOM elements
  const videoElement = document.querySelector('#xr-video');
  const audioElement = document.querySelector('#audio');
  const xrContainer = document.getElementById('xr-scene-container');
  const xrControls = document.getElementById('xr-controls');
  const launchXRButton = document.getElementById('launch-xr');
  const exitXRButton = document.getElementById('exit-xr');
  const rewindBtn = document.getElementById('rewind-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const muteBtn = document.getElementById('mute-btn');
  const albumArtContainer = document.querySelector('.centered-album-art');
  const loadingOverlay = document.getElementById('loading-overlay');
  
  // State
  let syncInterval = null;
  const TIME_SKIP_SECONDS = 10;
  let isXRActive = false;
  
  // Initialize XR Controller
  function init() {
    if (!videoElement || !audioElement || !xrContainer || !launchXRButton || !exitXRButton) {
      console.error('XR Controller: Required DOM elements not found');
      return;
    }
    
    // Ensure XR scene is initially hidden
    xrContainer.style.display = 'none';
    
    // Add event listeners
    launchXRButton.addEventListener('click', enterXRMode);
    exitXRButton.addEventListener('click', exitXRMode);
    
    // Add time skip event listeners if available
    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        if (isXRActive) {
          skipVideoTime(-TIME_SKIP_SECONDS);
        }
      });
    }
    
    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        if (isXRActive) {
          skipVideoTime(TIME_SKIP_SECONDS);
        }
      });
    }
    
    // Add mute event listener if available
    if (muteBtn && typeof PlayerControls !== 'undefined') {
      muteBtn.addEventListener('click', () => {
        if (isXRActive) {
          // Audio volume will be handled by the PlayerControls.toggleMute function
          // Video volume should be synced with audio
          videoElement.muted = audioElement.muted || audioElement.volume === 0;
        }
      });
    }
    
    // Sync with SharedState if available
    if (typeof SharedState !== 'undefined') {
      SharedState.subscribe('isXRModeChanged', (isXRMode) => {
        if (isXRMode) {
          activateXRMode();
        } else {
          deactivateXRMode();
        }
      });
      
      // Keep video mute state in sync with audio
      SharedState.subscribe('isMutedChanged', (isMuted) => {
        if (isXRActive) {
          videoElement.muted = isMuted;
        }
      });
      
      SharedState.subscribe('volumeChanged', (volume) => {
        if (isXRActive) {
          videoElement.volume = volume;
          videoElement.muted = volume === 0;
        }
      });
      
      // Subscribe to track changes to update XR button visibility
      SharedState.subscribe('currentTrackChanged', (track) => {
        updateXRButtonVisibility(track);
      });
    }
    
    // Add media sync event listeners
    audioElement.addEventListener('play', syncVideoPlayState);
    audioElement.addEventListener('pause', syncVideoPlayState);
    audioElement.addEventListener('seeking', syncVideoTime);
    audioElement.addEventListener('volumechange', syncVideoVolume);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
    
    // Initialize button visibility based on current track
    const initialTrack = typeof PlayerCore !== 'undefined' ? PlayerCore.getCurrentTrack() : null;
    updateXRButtonVisibility(initialTrack);
    
    console.log('XR Controller initialized');
  }
  
  // Update the XR button visibility based on track isXR property
  function updateXRButtonVisibility(track) {
    if (!launchXRButton) return;
    
    // Hide the XR button if track is not XR-enabled
    if (track && track.isXR === false) {
      console.log(`Track ${track.title} is not XR-enabled, hiding XR button`);
      launchXRButton.style.display = 'none';
      
      // If currently in XR mode, exit it
      if (isXRActive) {
        console.log('Exiting XR mode for non-XR track');
        exitXRMode();
      }
    } else if (track && track.videoSrc) {
      // Show the XR button if track has a video source
      console.log(`Track ${track.title} has XR content, showing XR button`);
      launchXRButton.style.display = 'inline-block';
    } else {
      // Hide the XR button if no track or no video source
      console.log('No track or video source available, hiding XR button');
      launchXRButton.style.display = 'none';
    }
  }
  
  // Enter XR mode button handler
  function enterXRMode() {
    console.log('Entering XR mode...');
    
    // Get video source from current track
    let videoSrc = '';
    if (typeof SharedState !== 'undefined') {
      const state = SharedState.getState();
      if (state.currentTrack && state.currentTrack.videoSrc) {
        videoSrc = state.currentTrack.videoSrc;
      }
    }
    
    // If video source is not available from SharedState, try to get it directly
    if (!videoSrc && videoElement) {
      videoSrc = videoElement.src || videoElement.dataset.lastSrc || '';
    }
    
    // If we don't have a video source, we can't enter XR mode
    if (!videoSrc) {
      console.error('No video source available for XR mode');
      alert('XR content is not available for this track.');
      return;
    }
    
    // Use MediaPreloader if available to ensure video is ready
    if (typeof MediaPreloader !== 'undefined') {
      // Show loading indicator
      MediaPreloader.showLoading();
      
      // Use the improved preloader which returns a promise
      MediaPreloader.preloadVideo(videoSrc)
        .then(() => {
          console.log('Video successfully preloaded, activating XR mode');
          activateXRMode();
          
          // Update shared state
          if (typeof SharedState !== 'undefined') {
            SharedState.updateState({ isXRMode: true });
          }
          
          // Make sure loading animation is definitely gone
          if (typeof MediaPreloader !== 'undefined') {
            MediaPreloader.forceHideLoading();
          } else if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
          }
          
          // Also add an additional check to remove the loading overlay when video starts playing
          videoElement.addEventListener('playing', function onFirstPlay() {
            videoElement.removeEventListener('playing', onFirstPlay);
            console.log('Video playing in XR mode - ensuring loading overlay is hidden');
            
            if (typeof MediaPreloader !== 'undefined') {
              MediaPreloader.forceHideLoading();
            } else if (loadingOverlay) {
              loadingOverlay.classList.remove('active');
            }
          }, { once: true });
        })
        .catch(error => {
          console.error('Error preloading video:', error);
          alert('There was a problem loading the XR content. Please try again.');
          MediaPreloader.hideLoading();
        });
    } else {
      // Fallback for when MediaPreloader is not available
      if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA = 3
        // Show loading indicator
        if (loadingOverlay) {
          loadingOverlay.classList.add('active');
        }
        
        // Wait for video to be ready
        videoElement.addEventListener('canplaythrough', function onVideoReady() {
          videoElement.removeEventListener('canplaythrough', onVideoReady);
          activateXRMode();
          
          // Hide loading indicator
          if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
          }
          
          // Update shared state
          if (typeof SharedState !== 'undefined') {
            SharedState.updateState({ isXRMode: true });
          }
        }, { once: true });
        
        // Force load the video
        videoElement.load();
        
        // Set a timeout in case the event never fires
        setTimeout(() => {
          if (videoElement.readyState < 3) {
            console.warn('Video preload timed out, activating XR mode anyway');
            activateXRMode();
            
            // Hide loading indicator
            if (loadingOverlay) {
              loadingOverlay.classList.remove('active');
            }
            
            // Update shared state
            if (typeof SharedState !== 'undefined') {
              SharedState.updateState({ isXRMode: true });
            }
          }
        }, 10000);
      } else {
        // Video is already loaded, activate XR mode immediately
        activateXRMode();
        
        // Update shared state
        if (typeof SharedState !== 'undefined') {
          SharedState.updateState({ isXRMode: true });
        }
      }
    }
  }
  
  // Exit XR mode button handler
  function exitXRMode() {
    console.log('Exiting XR mode...');
    deactivateXRMode();
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ isXRMode: false });
    }
  }
  
  // Skip video time forward or backward
  function skipVideoTime(seconds) {
    if (!videoElement || !audioElement) return;
    
    // Calculate new time
    const newTime = Math.max(0, Math.min(audioElement.duration, audioElement.currentTime + seconds));
    
    // Apply new time to both audio and video
    audioElement.currentTime = newTime;
    videoElement.currentTime = newTime;
    
    // Update shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        currentTime: newTime
      });
    }
  }
  
  // Sync video volume with audio, preserving master mute settings
  function syncVideoVolume() {
    if (!isXRActive) return;
    
    // In XR mode, transfer volume level from audio to video
    videoElement.volume = audioElement.volume;
    
    // Don't automatically change mute state when volume changes
    // Let toggleMasterMute handle mute state changes
  }
  
  // Activate XR mode visualization
  function activateXRMode() {
    console.log('Activating XR scene');
    
    // Force hide loading overlay if it exists
    if (typeof MediaPreloader !== 'undefined' && typeof MediaPreloader.forceHideLoading === 'function') {
      MediaPreloader.forceHideLoading();
    } else if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
    }
    
    // Remove xr-scene-hidden class from body
    document.body.classList.remove('xr-scene-hidden');
    
    // Show XR scene and hide album art
    xrContainer.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 9000 !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    `;
    
    // Make sure all A-Frame elements are visible
    const aframeElements = xrContainer.querySelectorAll('a-scene, .a-canvas');
    aframeElements.forEach(el => {
      el.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      `;
    });
    
    // Explicitly ensure A-Frame is properly initialized
    const scene = xrContainer.querySelector('a-scene');
    if (scene) {
      // Force scene visibility
      scene.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 9001 !important;
      `;
      
      // Make sure canvas is visible
      const canvas = scene.canvas;
      if (canvas) {
        canvas.style.cssText = `
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 9901 !important;
          opacity: 1 !important;
          visibility: visible !important;
        `;
      }
      
      // Force scene to resize if renderer exists
      if (scene.renderer) {
        scene.renderer.setSize(window.innerWidth, window.innerHeight);
        // Force re-render
        scene.renderStarted = true;
        scene.tick();
      }
      
      // Check and enable camera look controls
      const camera = scene.querySelector('[camera]');
      if (camera) {
        camera.setAttribute('look-controls', 'enabled: true; reverseMouseDrag: false');
      }

      // Make sure video is properly attached to videosphere
      const videosphere = scene.querySelector('a-videosphere');
      if (videosphere && videoElement) {
        // Force re-attach the video
        videosphere.removeAttribute('src');
        setTimeout(() => {
          videosphere.setAttribute('src', '#xr-video');
          console.log('Reattached video to videosphere');
        }, 50);
      }
    }
    
    if (albumArtContainer) {
      albumArtContainer.style.display = 'none';
    }
    
    // Mark XR as active
    isXRActive = true;
    
    // Update controls
    launchXRButton.style.display = 'none';
    exitXRButton.style.display = 'inline-block';
    
    // Show recenter button if it exists
    const recenterBtn = document.getElementById('recenter-camera-btn');
    if (recenterBtn) {
      recenterBtn.style.display = 'inline-block';
    }
    
    // If recenter handler function exists, call it
    if (typeof addRecenterCameraHandler === 'function') {
      // Wait a short time to ensure everything is initialized
      setTimeout(addRecenterCameraHandler, 100);
    }
    
    // Implement master audio control for XR mode
    
    // Get the audio element's current volume (but ignore its mute state)
    const savedVolume = audioElement.volume;
    const wasMuted = audioElement.muted;
    
    // Store the audio state for later restoration
    audioElement.dataset.prevVolume = savedVolume;
    audioElement.dataset.prevMuted = wasMuted;
    
    // CRITICAL FIX: Always unmute video in XR mode and set appropriate volume
    videoElement.volume = savedVolume;
    videoElement.muted = false; // Always ensure video is unmuted in XR mode
    
    // Always mute the audio element in XR mode
    audioElement.muted = true;
    
    console.log(`XR mode activated. Video unmuted with volume ${savedVolume}, audio muted.`);
    
    // Start the video if audio is already playing
    syncVideoPlayState();
    syncVideoTime();
    
    // Set up regular sync interval
    startSyncInterval();
    
    // Force video to appear if needed
    setTimeout(() => {
      if (isXRActive) {
        console.log('Force showing XR container');
        // Force visibility again after short delay
        xrContainer.style.cssText = `
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 9000 !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        `;
        
        // Force redraw of page
        window.dispatchEvent(new Event('resize'));
      }
    }, 100);
  }
  
  // Deactivate XR mode visualization
  function deactivateXRMode() {
    console.log('Deactivating XR scene');
    
    // Reset camera position before hiding scene
    try {
      const scene = xrContainer.querySelector('a-scene');
      if (scene) {
        const camera = scene.querySelector('[camera]');
        if (camera) {
          // Reset camera rotation to default
          camera.setAttribute('rotation', '0 0 0');
          
          // If using look-controls, also reset their state
          if (camera.components && camera.components['look-controls']) {
            const lookControls = camera.components['look-controls'];
            if (lookControls) {
              // Reset rotation objects manually
              if (lookControls.pitchObject) lookControls.pitchObject.rotation.x = 0;
              if (lookControls.yawObject) lookControls.yawObject.rotation.y = 0;
            }
          }
          console.log('Reset camera position for next XR entry');
        }
      }
    } catch (e) {
      console.error('Error resetting camera on XR exit:', e);
    }
    
    // Hide XR scene and show album art
    xrContainer.style.display = 'none';
    
    // Add class to hide XR scene
    document.body.classList.add('xr-scene-hidden');
    
    if (albumArtContainer) {
      albumArtContainer.style.display = 'block';
    }
    
    // Hide recenter button if it exists
    const recenterBtn = document.getElementById('recenter-camera-btn');
    if (recenterBtn) {
      recenterBtn.style.display = 'none';
    }
    
    // Mark XR as inactive
    isXRActive = false;
    
    // Update controls
    launchXRButton.style.display = 'inline-block';
    exitXRButton.style.display = 'none';
    
    // Get current video mute state to transfer to audio
    const videoWasMuted = videoElement.muted;
    
    // CRITICAL FIX: Always force audio to be unmuted when returning to audio-only mode
    // This ensures audio is always playing when in audio-only mode
    audioElement.muted = false;
    
    // Transfer any volume settings back
    if (audioElement.dataset.prevVolume) {
      audioElement.volume = parseFloat(audioElement.dataset.prevVolume);
    }
    
    // Always mute video when exiting XR mode
    videoElement.muted = true;
    
    console.log(`Exiting XR mode. Audio unmuted, video muted.`);
    
    // Stop video to save resources
    if (!videoElement.paused) {
      videoElement.pause();
    }
    
    // Clear sync interval
    stopSyncInterval();
    
    // Update UI state to match new audio state
    updateMuteUI(false); // Always show unmuted state when exiting XR mode
  }
  
  // Helper function to update mute UI
  function updateMuteUI(isMuted) {
    if (!muteBtn) return;
    
    const volumeIcon = muteBtn.querySelector('.volume-icon');
    const muteIcon = muteBtn.querySelector('.mute-icon');
    
    if (!volumeIcon || !muteIcon) return;
    
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
  
  // Keep video in sync with audio
  function syncVideoPlayState() {
    if (!isXRActive) return;
    
    if (!audioElement.paused && videoElement.paused) {
      // Audio is playing but video is paused - start video
      videoElement.play().catch(handleVideoPlayError);
    } else if (audioElement.paused && !videoElement.paused) {
      // Audio is paused but video is playing - pause video
      videoElement.pause();
    }
  }
  
  // Sync video time with audio time
  function syncVideoTime() {
    if (!isXRActive) return;
    
    if (Math.abs(videoElement.currentTime - audioElement.currentTime) > 0.3) {
      videoElement.currentTime = audioElement.currentTime;
    }
  }
  
  // Start regular sync interval
  function startSyncInterval() {
    stopSyncInterval(); // Clear any existing interval first
    syncInterval = setInterval(() => {
      syncVideoTime();
    }, 250); // Check every 250ms
  }
  
  // Stop sync interval
  function stopSyncInterval() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }
  
  // Helper function to check if in XR mode
  function isInXRMode() {
    return isXRActive;
  }
  
  // Handle errors when video can't autoplay
  function handleVideoPlayError(error) {
    console.log('Video autoplay prevented:', error);
    
    // Try again with user interaction
    const resumePlayback = () => {
      videoElement.play().catch(e => {
        console.error('Failed to play video even after user interaction:', e);
      });
      document.removeEventListener('click', resumePlayback);
    };
    
    document.addEventListener('click', resumePlayback, { once: true });
    
    // Optionally log error to shared state
    if (typeof SharedState !== 'undefined') {
      SharedState.logError({
        message: 'Video autoplay prevented',
        details: error.message
      });
    }
  }
  
  // Modified toggleMute function for master control
  function toggleMasterMute() {
    if (!videoElement || !audioElement) return;
    
    if (isXRActive) {
      // In XR mode: Toggle video mute state directly
      videoElement.muted = !videoElement.muted;
      const newMuteState = videoElement.muted;
      
      // Keep audio element muted in XR mode
      audioElement.muted = true;
      
      console.log(`XR mode: Video ${newMuteState ? 'muted' : 'unmuted'}, Audio element remains muted`);
      
      // Update shared state to reflect the video's mute state
      if (typeof SharedState !== 'undefined') {
        SharedState.updateState({ 
          isMuted: newMuteState
        });
      }
      
      return newMuteState;
    } else {
      // In audio-only mode: Toggle audio mute state
      audioElement.muted = !audioElement.muted;
      const newMuteState = audioElement.muted;
      
      // Always keep video muted in audio-only mode
      videoElement.muted = true;
      
      console.log(`Audio-only mode: Audio ${newMuteState ? 'muted' : 'unmuted'}, Video remains muted`);
      
      // Update shared state
      if (typeof SharedState !== 'undefined') {
        SharedState.updateState({ 
          isMuted: newMuteState
        });
      }
      
      return newMuteState;
    }
  }
  
  // Clean up resources
  function cleanup() {
    stopSyncInterval();
    
    // Remove event listeners
    launchXRButton.removeEventListener('click', enterXRMode);
    exitXRButton.removeEventListener('click', exitXRMode);
    audioElement.removeEventListener('play', syncVideoPlayState);
    audioElement.removeEventListener('pause', syncVideoPlayState);
    audioElement.removeEventListener('seeking', syncVideoTime);
    audioElement.removeEventListener('volumechange', syncVideoVolume);
  }
  
  // Public API
  return {
    init,
    enterXRMode,
    exitXRMode,
    skipVideoTime,
    isInXRMode,
    toggleMasterMute,
    recenterCamera,
    updateXRButtonVisibility
  };
})();

// Add a global recenter camera function that works even outside XRController module
function recenterCamera() {
  console.log('Global recenter camera function called');
  
  try {
    // Get the A-Frame scene and camera
    const scene = document.querySelector('a-scene');
    if (!scene) {
      console.log('Scene not found for recenter');
      return false;
    }
    
    const camera = scene.querySelector('[camera]');
    if (!camera) {
      console.log('Camera not found for recenter');
      return false;
    }
    
    // Reset camera rotation
    camera.setAttribute('rotation', '0 0 0');
    
    // Multiple methods for resetting camera to ensure it works
    
    // Method 1: Update look-controls directly if available
    if (camera.components && camera.components['look-controls']) {
      const lookControls = camera.components['look-controls'];
      if (lookControls) {
        // Reset rotation objects manually
        if (lookControls.pitchObject) lookControls.pitchObject.rotation.x = 0;
        if (lookControls.yawObject) lookControls.yawObject.rotation.y = 0;
        
        // Try to call resetPose if it exists
        if (typeof lookControls.resetPose === 'function') {
          lookControls.resetPose();
        }
      }
    }
    
    // Method 2: Force position reset
    camera.setAttribute('position', '0 1.6 0');
    
    // Method 3: Try to remove and re-add look-controls
    try {
      const hasLookControls = camera.hasAttribute('look-controls');
      const lookControlsValue = camera.getAttribute('look-controls');
      
      // Store current attribute
      camera.removeAttribute('look-controls');
      
      // Add it back after a short delay
      setTimeout(() => {
        if (hasLookControls) {
          if (typeof lookControlsValue === 'string') {
            camera.setAttribute('look-controls', lookControlsValue);
          } else {
            camera.setAttribute('look-controls', 'enabled: true; reverseMouseDrag: false');
          }
        }
      }, 50);
    } catch (e) {
      console.error('Error removing/adding look-controls:', e);
    }
    
    // Method 4: Emit camera reset event
    camera.emit('recenter');
    scene.emit('recenter-camera');
    
    console.log('Camera view reset complete');
    return true;
  } catch (e) {
    console.error('Error during camera recenter:', e);
    return false;
  }
} 