// Profile Modal Functionality
function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
  
  // Compute API base URL for avatar
  const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
    ? 'http://localhost:3000'
    : '';

  // Populate fields
  document.getElementById('profile-name').value = user.name || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-password').value = '';
  
  // Set avatar preview
  const avatarPreview = document.getElementById('profile-avatar-preview');
  if (user.avatarPath) {
    // Extract filename from the path
    const filename = user.avatarPath.split('/').pop();
    const avatarUrl = `${API_BASE}/api/users/profile/avatar/${filename}`;
    console.log('Setting profile modal avatar:', avatarUrl);
    
    avatarPreview.textContent = '';
    avatarPreview.style.backgroundImage = `url(${avatarUrl})`;
    avatarPreview.style.backgroundSize = 'cover';
    avatarPreview.style.backgroundPosition = 'center';
  } else {
    avatarPreview.style.backgroundImage = '';
    avatarPreview.textContent = (user.name || 'U').charAt(0).toUpperCase();
  }
  
  modal.style.display = 'flex';
}

function closeProfileModal() {
  document.getElementById('profile-modal').style.display = 'none';
  document.getElementById('profile-error').style.display = 'none';
}

// Initialize profile functionality
function initializeProfile() {
  // Add profile modal HTML to the page
  const modalHTML = `
    <div id="profile-modal" class="modal" style="display:none;position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(2,6,23,0.5);align-items:center;justify-content:center;z-index:1200">
      <div style="background:#fff;border-radius:12px;max-width:420px;width:100%;padding:24px;box-shadow:0 12px 30px rgba(2,6,23,0.2)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div style="font-weight:700;font-size:1.25rem;color:#1e293b">My Profile</div>
          <button id="profile-close" style="background:transparent;border:0;font-size:20px;cursor:pointer;color:#64748b">✕</button>
        </div>

        <form id="profile-form">
          <div style="text-align:center;margin-bottom:24px">
            <div id="profile-avatar-preview" style="width:120px;height:120px;margin:0 auto;background-color:#f3f4f6;color:#1e293b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:700;margin-bottom:12px;background-position:center;background-size:cover;overflow:hidden;">A</div>
            <input type="file" id="avatar-input" accept="image/*" style="display:none">
            <button type="button" id="change-avatar-btn" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.875rem;transition:all 0.2s">
              Change Avatar
            </button>
          </div>

          <div style="margin-bottom:16px">
            <label for="profile-name" style="display:block;margin-bottom:6px;color:#475569;font-size:0.875rem;font-weight:500">
              Display Name
            </label>
            <input id="profile-name" type="text" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.95rem" required>
          </div>

          <div style="margin-bottom:16px">
            <label for="profile-email" style="display:block;margin-bottom:6px;color:#475569;font-size:0.875rem;font-weight:500">
              Email
            </label>
            <input id="profile-email" type="email" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:0.95rem" readonly>
          </div>

          <div style="margin-bottom:20px">
            <label for="profile-password" style="display:block;margin-bottom:6px;color:#475569;font-size:0.875rem;font-weight:500">
              New Password
            </label>
            <input id="profile-password" type="password" placeholder="Leave blank to keep current password" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.95rem">
          </div>

          <div id="profile-error" style="display:none;color:#dc2626;font-size:0.875rem;margin-bottom:16px;padding:8px 12px;background:#fef2f2;border-radius:6px;font-weight:500"></div>

          <div style="display:flex;gap:12px;justify-content:flex-end">
            <button type="button" onclick="closeProfileModal()" style="padding:9px 16px;border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:8px;font-weight:500;cursor:pointer">
              Cancel
            </button>
            <button type="submit" style="padding:9px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add modal HTML to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Add event listeners and style handler
  const userAvatar = document.querySelector('.user-avatar');
  if (!userAvatar) {
    console.error('User avatar element not found');
    return;
  }
  
  // Set base styles
  userAvatar.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.875rem;
    cursor: pointer;
    background-color: #f3f4f6;
    color: #1e293b;
    overflow: hidden;
  `;

  userAvatar.addEventListener('click', openProfileModal);
  document.getElementById('profile-close').addEventListener('click', closeProfileModal);
  
  // Handle avatar change
  document.getElementById('change-avatar-btn').addEventListener('click', () => {
    document.getElementById('avatar-input').click();
  });

  document.getElementById('avatar-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const avatarPreview = document.getElementById('profile-avatar-preview');
        avatarPreview.style.cssText = `
          width: 120px;
          height: 120px;
          margin: 0 auto;
          background-color: transparent;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 12px;
          background-image: url(${e.target.result});
          background-position: center;
          background-size: cover;
        `;
        avatarPreview.textContent = '';
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle profile form submission
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('profile-name').value.trim();
    const password = document.getElementById('profile-password').value;
    const errorDiv = document.getElementById('profile-error');
    const token = localStorage.getItem('cw_token');
    
    try {
      const formData = new FormData();
      formData.append('name', name);
      if (password) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        formData.append('password', password);
      }
      
      const avatarInput = document.getElementById('avatar-input');
      if (avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
      }

      // Compute API base URL
      const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
        ? 'http://localhost:3000'
        : '';
        
      console.log('Sending profile update with formData:', {
        name: formData.get('name'),
        hasAvatar: formData.has('avatar'),
        avatarName: formData.get('avatar')?.name
      });

      const response = await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Profile update failed:', data);
        throw new Error(data.message || 'Failed to update profile');
      }

      const data = await response.json();
      console.log('Profile update response:', data);
      
      // Update local storage with new user data
      const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
      user.name = name;
      if (data.user.avatarPath) {
        user.avatarPath = data.user.avatarPath;
        // Store the full URL to prevent path issues
        user.avatarUrl = `${API_BASE}/${data.user.avatarPath}`;
      }
      localStorage.setItem('cw_user', JSON.stringify(user));
      
      console.log('Updated user data in localStorage:', user);

      // Update UI
      const userNameElements = document.querySelectorAll('.user-name');
      userNameElements.forEach(el => el.textContent = name);
      
      const avatarElements = document.querySelectorAll('.user-avatar');
      avatarElements.forEach(avatarElement => {
        if (data.user.avatarPath) {
          // Extract filename from the path
          const filename = data.user.avatarPath.split('/').pop();
          const avatarUrl = `${API_BASE}/api/users/profile/avatar/${filename}`;
          console.log('Setting avatar image:', avatarUrl);
          // Create and append image
          const img = document.createElement('img');
          img.src = avatarUrl;
          img.alt = "User Avatar";
          img.style.cssText = `
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            display: block;
          `;
          
          // Log any image loading errors
          img.onerror = (err) => {
            console.error('Failed to load avatar image:', err, avatarUrl);
          };
          
          avatarElement.innerHTML = '';
          avatarElement.style.backgroundColor = 'transparent';
          avatarElement.appendChild(img);
        } else {
          console.log('Setting avatar initials for:', name);
          avatarElement.innerHTML = '';
          avatarElement.style.backgroundColor = '#f3f4f6';
          avatarElement.style.color = '#1e293b';
          avatarElement.textContent = name.charAt(0).toUpperCase();
        }
      });
      
      closeProfileModal();
      alert('Profile updated successfully');

    } catch (error) {
      console.error('Profile update error:', error);
      errorDiv.textContent = error.message || 'Failed to update profile. Please try again.';
      errorDiv.style.display = 'block';
    }
  });
}

// Call initialize when DOM is loaded
// Initialize user avatar display
function updateUserAvatar(forceUpdate = false) {
  console.log('Updating user avatar...');
  const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
  console.log('User data:', user);
  
  // Find all avatar elements (both by ID and class)
  const avatarElements = [
    ...document.querySelectorAll('.user-avatar'),
    document.getElementById('user-avatar')
  ].filter(el => el); // Remove null elements

  if (!avatarElements.length) {
    console.error('No avatar elements found in the document');
    return;
  }

  const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
    ? 'http://localhost:3000'
    : '';
    
  avatarElements.forEach(avatarElement => {
    // Check if element has already been initialized and force update is not requested
    if (!forceUpdate && avatarElement.dataset.initialized === 'true') {
      console.log('Avatar already initialized, skipping:', avatarElement);
      return;
    }

    // Make sure the element has base styles
    avatarElement.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background-color: #f3f4f6;
      color: #1e293b;
      font-weight: bold;
      cursor: pointer;
    `;

    if (user.avatarPath) {
      // Extract filename from the path
      const filename = user.avatarPath.split('/').pop();
      const imgUrl = `${API_BASE}/api/users/profile/avatar/${filename}`;
      console.log('Displaying avatar image:', imgUrl);
      
      // Check if image is already cached
      const img = new Image();
      img.alt = "User Avatar";
      img.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
      `;
      
      // Set up loading handlers before setting src
      img.onload = () => {
        console.log('Avatar image loaded successfully');
        // Clear styles that might interfere with image display
        avatarElement.style.backgroundColor = 'transparent';
        avatarElement.style.color = 'transparent';
        // Clear previous content and append new image
        avatarElement.innerHTML = '';
        avatarElement.appendChild(img);
        // Mark as initialized
        avatarElement.dataset.initialized = 'true';
      };
      
      img.onerror = (err) => {
        console.error('Failed to load avatar image:', err);
        // Fallback to initials if image fails to load
        avatarElement.style.backgroundColor = '#f3f4f6';
        avatarElement.style.color = '#1e293b';
        avatarElement.textContent = (user.name || 'U').charAt(0).toUpperCase();
        avatarElement.dataset.initialized = 'true';
      };

      // Start loading the image
      img.src = imgUrl;
    } else {
      console.log('Displaying avatar initials for:', user.name);
      avatarElement.textContent = (user.name || 'U').charAt(0).toUpperCase();
      avatarElement.dataset.initialized = 'true';
    }
  });
}

// Function to validate and update avatar URL
function validateAndUpdateAvatarUrl() {
  const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
  if (user.avatarPath && !user.avatarUrl) {
    const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
      ? 'http://localhost:3000'
      : '';
    // Extract filename from the path
    const filename = user.avatarPath.split('/').pop();
    user.avatarUrl = `${API_BASE}/api/users/profile/avatar/${filename}`;
    localStorage.setItem('cw_user', JSON.stringify(user));
  }
}

// Function to ensure avatar displays correctly across page loads
function ensureAvatarDisplay() {
  const user = JSON.parse(localStorage.getItem('cw_user') || '{}');
  const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
    ? 'http://localhost:3000'
    : '';

  // If we have an avatar path, make sure we store the full URL
  if (user.avatarPath && !user.avatarUrl) {
    user.avatarUrl = `${API_BASE}/${user.avatarPath}`;
    localStorage.setItem('cw_user', JSON.stringify(user));
  }

  // Force avatar update after a short delay to ensure it overrides any page-specific initialization
  setTimeout(updateUserAvatar, 100);
}

// Set up mutation observer to watch for new avatar elements
function setupAvatarObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const avatarElements = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === 1) // Only element nodes
        .filter(element => 
          element.matches?.('.user-avatar') || // Is avatar element
          element.querySelector?.('.user-avatar') || // Contains avatar element
          element.id === 'user-avatar'
        );

      if (avatarElements.length > 0) {
        console.log('New avatar elements detected:', avatarElements);
        updateUserAvatar();
      }
    });
  });

  // Observe the whole document for added nodes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

// Function to ensure profile features are ready
function ensureProfileFeatures() {
  // Initialize profile modal if not already present
  if (!document.getElementById('profile-modal')) {
    initializeProfile();
  }
  
  // Force update all avatar elements
  updateUserAvatar(true);
  
  // Store current timestamp of last avatar update
  localStorage.setItem('cw_avatar_last_updated', Date.now().toString());
}

// Check if we need to reinitialize avatars based on timestamp
function checkAvatarTimestamp() {
  const lastUpdated = localStorage.getItem('cw_avatar_last_updated');
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes in milliseconds
  
  if (!lastUpdated || parseInt(lastUpdated) < fiveMinutesAgo) {
    console.log('Avatar timestamp stale, reinitializing...');
    updateUserAvatar(true);
    localStorage.setItem('cw_avatar_last_updated', now.toString());
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Setup mutation observer
  const observer = setupAvatarObserver();
  
  // Initial setup
  ensureProfileFeatures();
  
  // Clean up observer when page unloads
  window.addEventListener('unload', () => {
    observer.disconnect();
  });
});

// Update avatar when page becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAvatarTimestamp();
  }
});