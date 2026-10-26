/**
 * Navigation utility to handle browser history and authentication flow
 */

class NavigationManager {
  constructor() {
    this.navigationHistory = [];
    this.maxHistoryLength = 10;
  }

  /**
   * Initialize navigation tracking
   */
  init() {
    // Track navigation events
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", this.handlePopState.bind(this));

      // Store initial entry
      this.addToHistory(window.location.pathname);
    }
  }

  /**
   * Add path to navigation history
   */
  addToHistory(path) {
    this.navigationHistory.push({
      path,
      timestamp: Date.now(),
    });

    // Limit history length
    if (this.navigationHistory.length > this.maxHistoryLength) {
      this.navigationHistory.shift();
    }
  }

  /**
   * Handle browser back/forward button
   */
  handlePopState(event) {
    const currentPath = window.location.pathname;
    console.log("Navigation changed:", currentPath, event.state);
  }

  /**
   * Check if user is trying to navigate back to auth page
   */
  isNavigatingToAuthPage(path) {
    const authPages = ["/login", "/register", "/admin/login"];
    return authPages.includes(path);
  }

  /**
   * Get appropriate redirect path based on user role
   */
  getRedirectPath(user) {
    if (!user) return "/login";

    if (user.role === "admin") {
      return "/admin/dashboard";
    }

    return "/dashboard";
  }

  /**
   * Clear navigation history
   */
  clearHistory() {
    this.navigationHistory = [];
  }

  /**
   * Get last valid navigation path (excluding auth pages)
   */
  getLastValidPath(isAuthenticated) {
    if (!isAuthenticated) return null;

    for (let i = this.navigationHistory.length - 1; i >= 0; i--) {
      const { path } = this.navigationHistory[i];
      if (!this.isNavigatingToAuthPage(path) && path !== "/") {
        return path;
      }
    }

    return null;
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.handlePopState.bind(this));
    }
  }
}

// Create singleton instance
const navigationManager = new NavigationManager();

// Initialize when module loads
if (typeof window !== "undefined") {
  navigationManager.init();
}

export default navigationManager;
