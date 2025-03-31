/**
 * Shared State - Centralized state management for the XR Player
 * This module manages the state of the player that needs to be shared
 * between different components.
 */
const SharedState = (function() {
  // Private state
  const state = {
    isXRMode: false,
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    mediaReady: false,
    videoBuffered: false,
    audioBuffered: false,
    currentTrack: null,
    playlist: {
      tracks: [],
      currentIndex: -1
    },
    errors: []
  };

  // Event system
  const events = {};

  // Subscribe to state changes
  function subscribe(event, callback) {
    if (!events[event]) {
      events[event] = [];
    }
    events[event].push(callback);
    return () => {
      events[event] = events[event].filter(cb => cb !== callback);
    };
  }

  // Notify subscribers of state changes
  function emit(event, data) {
    if (events[event]) {
      events[event].forEach(callback => callback(data));
    }
  }

  // Update state and notify subscribers
  function updateState(updates) {
    const changedKeys = [];
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (state.hasOwnProperty(key) && state[key] !== updates[key]) {
        state[key] = updates[key];
        changedKeys.push(key);
      }
    });
    
    // Emit events for changed properties
    if (changedKeys.length > 0) {
      emit('stateChanged', { 
        changedKeys,
        state: getState()
      });
      
      // Also emit specific events for each changed key
      changedKeys.forEach(key => {
        emit(`${key}Changed`, state[key]);
      });
    }
  }

  // Get current state (immutable copy)
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  // Log errors
  function logError(error) {
    console.error('Player Error:', error);
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      details: error.stack || null
    };
    
    state.errors.push(errorRecord);
    emit('error', errorRecord);
  }

  // Public API
  return {
    getState,
    updateState,
    subscribe,
    logError
  };
})(); 