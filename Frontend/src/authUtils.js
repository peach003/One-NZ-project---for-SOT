// Authentication utility functions to handle multi-tab scenarios

// Generate a unique tab ID
const getTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

// Store authentication data with tab information
export const storeAuth = (token, user) => {
  const tabId = getTabId();

  // Store in localStorage with tab information
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('currentTabId', tabId);
  localStorage.setItem(`lastLogin_${user.account}`, Date.now().toString());

  // Also store in sessionStorage for tab-specific access
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
};

// Get authentication token with validation
export const getAuthToken = () => {
  // First check sessionStorage (tab-specific)
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken) {
    return sessionToken;
  }

  // Fallback to localStorage but validate it's for current tab
  const tabId = getTabId();
  const currentTabId = localStorage.getItem('currentTabId');

  if (tabId === currentTabId) {
    return localStorage.getItem('token');
  }

  // Token belongs to another tab, don't use it
  return null;
};

// Get current user with validation
export const getCurrentUser = () => {
  // First check sessionStorage
  const sessionUser = sessionStorage.getItem('user');
  if (sessionUser) {
    return JSON.parse(sessionUser);
  }

  // Fallback to localStorage but validate
  const tabId = getTabId();
  const currentTabId = localStorage.getItem('currentTabId');

  if (tabId === currentTabId) {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  return null;
};

// Clear authentication data
export const clearAuth = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('currentTabId');
};

// Check if authentication has changed (for detecting cross-tab login)
export const hasAuthChanged = (originalUserId) => {
  const currentUser = getCurrentUser();
  return currentUser && currentUser.id !== originalUserId;
};