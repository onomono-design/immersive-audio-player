/**
 * Media Preloader - Handles media preloading for both audio and video
 * This module ensures media files are preloaded before playback to avoid buffering.
 */
const MediaPreloader = (function() {
  // DOM elements
  const loadingOverlay = document.getElementById('loading-overlay');
  const videoElement = document.querySelector('#xr-video');
  const audioElement = document.querySelector('#audio');
  
  // State
  let videoPreloadPromise = null;
  let audioPreloadPromise = null;
  let activeLoadingCount = 0;
  let isInitialized = false;
  
  // Initialize media preloader
  function init() {
    if (!videoElement || !audioElement) {
      console.error('Media Preloader: Required DOM elements not found');
      return;
    }
    
    console.log('Media Preloader initialized');
    isInitialized = true;
    
    // Initialize SharedState with preloading status
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        videoBuffered: false,
        audioBuffered: false,
        isPreloading: false
      });
    }
  }
  
  // Preload video content for XR mode
  function preloadVideo(videoSrc) {
    // If preload promise already exists for this source, return it
    if (videoPreloadPromise && videoElement.src === videoSrc) {
      return videoPreloadPromise;
    }
    
    // Reset previous preload if source is different
    if (videoElement.src !== videoSrc) {
      console.log('Starting new video preload for:', videoSrc);
      videoPreloadPromise = null;
    }
    
    // Return existing promise if already preloading this source
    if (videoPreloadPromise) {
      return videoPreloadPromise;
    }
    
    showLoading();
    console.log('Preloading video:', videoSrc);
    
    // Create new preloading promise
    videoPreloadPromise = new Promise((resolve, reject) => {
      // Configure video element
      videoElement.muted = true; // Must be muted for autoplay in some browsers
      
      // Update SharedState
      if (typeof SharedState !== 'undefined') {
        SharedState.updateState({ 
          videoBuffered: false,
          isPreloading: true
        });
      }
      
      // Multiple resolution methods to make it more reliable
      let resolved = false;
      const markAsResolved = () => {
        if (!resolved) {
          resolved = true;
          
          // Update SharedState
          if (typeof SharedState !== 'undefined') {
            SharedState.updateState({ 
              videoBuffered: true,
              isPreloading: false
            });
          }
          
          console.log('Video preloaded successfully');
          // Use our more reliable force hide method
          forceHideLoading();
          resolve(videoElement);
        }
      };
      
      // Setup error handler
      const handleError = (error) => {
        if (!resolved) {
          console.error('Error preloading video:', error);
          
          // Try one more time with a different approach
          console.log('Attempting fallback loading method...');
          
          try {
            // Create a temporary video element as a backup loading method
            const tempVideo = document.createElement('video');
            tempVideo.setAttribute('muted', 'true');
            tempVideo.muted = true;
            tempVideo.style.display = 'none';
            tempVideo.crossOrigin = 'anonymous';
            document.body.appendChild(tempVideo);
            
            // Setup listeners on temp video
            tempVideo.addEventListener('canplaythrough', () => {
              // Successfully loaded in temp video, now transfer to main video
              videoElement.src = videoSrc;
              
              // Cleanup temp video
              document.body.removeChild(tempVideo);
              
              console.log('Fallback loading successful');
              markAsResolved();
            }, { once: true });
            
            tempVideo.addEventListener('error', (e) => {
              // Both loading attempts failed
              document.body.removeChild(tempVideo);
              
              // Update SharedState with error
              if (typeof SharedState !== 'undefined') {
                SharedState.logError({
                  message: 'Error preloading video (both attempts failed)',
                  details: e.message
                });
                
                SharedState.updateState({ 
                  videoBuffered: false,
                  isPreloading: false
                });
              }
              
              // Even though loading failed, we'll mark as resolved anyway to prevent blocking
              console.log('Fallback loading also failed, continuing anyway');
              markAsResolved();
            }, { once: true });
            
            // Start loading
            tempVideo.src = videoSrc;
            tempVideo.load();
          } catch (fallbackError) {
            console.error('Fallback loading method failed:', fallbackError);
            // Update SharedState with error
            if (typeof SharedState !== 'undefined') {
              SharedState.logError({
                message: 'All loading attempts failed',
                details: fallbackError.message
              });
            }
            
            // Even though loading failed, we'll resolve anyway to prevent blocking
            console.log('All loading methods failed, continuing anyway');
            markAsResolved();
          }
        }
      };
      
      // Clear any previous event listeners
      videoElement.removeEventListener('canplaythrough', markAsResolved);
      videoElement.removeEventListener('error', handleError);
      
      // Multiple event listeners for different browser behaviors
      videoElement.addEventListener('canplaythrough', markAsResolved, { once: true });
      videoElement.addEventListener('loadeddata', () => {
        console.log('Video loadeddata fired (readyState:', videoElement.readyState, ')');
        if (videoElement.readyState >= 3) {
          markAsResolved();
        }
      }, { once: true });
      videoElement.addEventListener('playing', () => {
        console.log('Video playing event fired');
        markAsResolved();
      }, { once: true });
      
      videoElement.addEventListener('error', handleError, { once: true });
      
      // Start loading the video with all required attributes
      videoElement.crossOrigin = 'anonymous';
      videoElement.preload = 'auto';
      videoElement.src = videoSrc;
      videoElement.load();
      
      // Force video to start buffering using multiple techniques
      setTimeout(() => {
        if (!resolved) {
          try {
            // Technique 1: Play then pause
            videoElement.play().then(() => {
              videoElement.pause();
              videoElement.currentTime = 0;
              console.log('Video played and paused to force preloading');
              
              // If this succeeds, we might be ready to go
              if (videoElement.readyState >= 3) {
                markAsResolved();
              }
            }).catch(e => {
              console.warn('Autoplay for preloading not permitted by browser:', e);
              
              // Technique 2: Try setting currentTime to force buffering
              try {
                videoElement.currentTime = 0.1;
                setTimeout(() => videoElement.currentTime = 0, 100);
                console.log('Used currentTime change to force preloading');
              } catch (timeError) {
                console.warn('CurrentTime setting failed:', timeError);
              }
            });
          } catch (e) {
            console.warn('Error during forced preload:', e);
          }
        }
      }, 100);
      
      // Start checking readyState periodically
      let readyStateCheckCount = 0;
      const readyStateInterval = setInterval(() => {
        readyStateCheckCount++;
        if (resolved) {
          clearInterval(readyStateInterval);
          return;
        }
        
        console.log(`Video readyState check ${readyStateCheckCount}: ${videoElement.readyState}`);
        
        // If we've reached a good readyState, mark as resolved
        if (videoElement.readyState >= 3) {
          clearInterval(readyStateInterval);
          markAsResolved();
        }
        
        // After 10 checks (5 seconds), give up and resolve anyway
        if (readyStateCheckCount >= 10) {
          clearInterval(readyStateInterval);
          console.warn('Video preload readyState checks timed out - continuing anyway');
          markAsResolved();
        }
      }, 500);
      
      // Set a final timeout in case the events never fire
      setTimeout(() => {
        clearInterval(readyStateInterval);
        if (!resolved) {
          console.warn('Video preload timeout - continuing anyway');
          markAsResolved();
        }
      }, 10000);
    });
    
    return videoPreloadPromise;
  }
  
  // Show loading overlay
  function showLoading() {
    activeLoadingCount++;
    
    if (loadingOverlay) {
      loadingOverlay.classList.add('active');
    }
    
    // Update SharedState
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ isPreloading: true });
    }
  }
  
  // Hide loading overlay
  function hideLoading() {
    activeLoadingCount = Math.max(0, activeLoadingCount - 1);
    
    if (activeLoadingCount === 0 && loadingOverlay) {
      loadingOverlay.classList.remove('active');
      
      // Update SharedState
      if (typeof SharedState !== 'undefined') {
        SharedState.updateState({ isPreloading: false });
      }
    }
    
    // Force hide after a brief delay to ensure it's gone
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.classList.remove('active');
      }, 300);
    }
  }
  
  // Force hide loading overlay with no count checks
  function forceHideLoading() {
    // Reset counter
    activeLoadingCount = 0;
    
    // Hide overlay
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
      
      // Also force with inline style as backup
      loadingOverlay.style.opacity = '0';
      loadingOverlay.style.pointerEvents = 'none';
      
      // Re-enable after a delay to prevent getting stuck
      setTimeout(() => {
        loadingOverlay.style.removeProperty('opacity');
        loadingOverlay.style.removeProperty('pointer-events');
      }, 1000);
    }
    
    // Update SharedState
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ isPreloading: false });
    }
    
    console.log('Force-hidden loading overlay');
  }
  
  // Get video buffering status
  function isVideoBuffered(videoSrc) {
    if (!videoElement) return false;
    
    // Only consider a video buffered if:
    // 1. Its current src matches the requested src
    // 2. It has loaded enough data
    return videoElement.src === videoSrc && videoElement.readyState >= 3;
  }
  
  // Reset preload state for a new track
  function resetPreloadState() {
    videoPreloadPromise = null;
    audioPreloadPromise = null;
    
    // Update SharedState
    if (typeof SharedState !== 'undefined') {
      SharedState.updateState({ 
        videoBuffered: false,
        audioBuffered: false
      });
    }
  }
  
  // Public API
  return {
    init,
    preloadVideo,
    showLoading,
    hideLoading,
    forceHideLoading,
    isVideoBuffered,
    resetPreloadState
  };
})();

// Initialize the preloader when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    MediaPreloader.init();
  });
} else {
  MediaPreloader.init();
} 