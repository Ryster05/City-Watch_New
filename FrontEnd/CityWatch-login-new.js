// Compute API base (support file:// open)
const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : '';

const statusMessage = document.getElementById('status-message');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

// Tab switching functionality
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update form sections
  document.querySelectorAll('.form-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`${tabName}-form`).classList.add('active');

  // Clear any status messages
  hideStatus();
}

// Add tab click listeners
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
  });
});

// Role selection functionality
function selectRole(roleButton) {
  // Remove active class from all role options in the same form
  const formSection = roleButton.closest('.form-section');
  formSection.querySelectorAll('.role-option').forEach(option => {
    option.classList.remove('active');
  });
  
  // Add active class to selected role
  roleButton.classList.add('active');
}

// Get selected role from a form section
function getSelectedRole(formSection) {
  const activeRole = formSection.querySelector('.role-option.active');
  return activeRole ? activeRole.dataset.role : 'user';
}

// Add role selection listeners
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.role-option').forEach(option => {
    option.addEventListener('click', function() {
      selectRole(this);
    });
  });
});

// Password toggle functionality
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'bx bx-show toggle-password';
  } else {
    input.type = 'password';
    icon.className = 'bx bx-hide toggle-password';
  }
}

// Add click listeners for password toggles
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      togglePassword(targetId);
    });
  });
});

// Status message functions
function showStatus(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';
}

function hideStatus() {
  statusMessage.style.display = 'none';
}

function setLoading(button, loading) {
  button.disabled = loading;
  const originalText = button.textContent;
  button.textContent = loading ? 'Please wait...' : originalText;
}

// Check if user is already logged in
function checkAuthStatus() {
  const token = localStorage.getItem('cw_token');
  const userRole = localStorage.getItem('cw_user_role');
  
  if (token) {
    // Redirect based on role
    if (userRole === 'admin') {
      window.location.href = 'CityWatch-Admin-Dashboard.html';
    } else {
      window.location.href = 'CityWatch-User-Home.html';
    }
  }
}

// Initialize auth check
checkAuthStatus();

// Login form handler
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();
    setLoading(loginBtn, true);

    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showStatus('Please fill in all fields.', 'error');
        setLoading(loginBtn, false);
        return;
      }

      // Do not send a role here — allow the server to determine the account's role (admin/user)
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If email needs verification, redirect to verification page
        if (data.needsVerification) {
          showStatus('Please verify your email to continue.', 'info');
          setTimeout(() => {
            window.location.href = `CityWatch-Verify-Email.html?email=${encodeURIComponent(data.email)}`;
          }, 1500);
          return;
        }
        showStatus(data.message || 'Login failed. Please try again.', 'error');
        setLoading(loginBtn, false);
        return;
      }

      // Store user data
      localStorage.setItem('cw_token', data.token);
      localStorage.setItem('cw_user', JSON.stringify(data.user));
      localStorage.setItem('cw_user_role', data.user.role || 'user');
      
      // Log role for debugging
      console.log('Login successful. Role:', data.user.role);

      showStatus('Login successful! Redirecting...', 'success');

      // Redirect based on role
      setTimeout(() => {
        if (data.user.role === 'admin') {
          window.location.href = 'CityWatch-Admin-Dashboard.html';
        } else {
          window.location.href = 'CityWatch-User-Home.html';
        }
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      showStatus('Network error. Please check your connection and try again.', 'error');
    } finally {
      setLoading(loginBtn, false);
    }
  });
}

// Signup form handler
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();
    setLoading(signupBtn, true);

    try {
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const confirmPassword = document.getElementById('signup-confirm-password').value;
      const selectedRole = getSelectedRole(document.getElementById('signup-form'));

      // Validation
      if (!name || !email || !password || !confirmPassword) {
        showStatus('Please fill in all fields.', 'error');
        setLoading(signupBtn, false);
        return;
      }

      if (password !== confirmPassword) {
        showStatus('Passwords do not match.', 'error');
        setLoading(signupBtn, false);
        return;
      }

      if (password.length < 6) {
        showStatus('Password must be at least 6 characters long.', 'error');
        setLoading(signupBtn, false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role: selectedRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        showStatus(data.message || 'Signup failed. Please try again.', 'error');
        setLoading(signupBtn, false);
        return;
      }

      // Store user data
      localStorage.setItem('cw_token', data.token);
      localStorage.setItem('cw_user', JSON.stringify(data.user));
      localStorage.setItem('cw_user_role', data.user.role || 'user');
      
      // Log role for debugging
      console.log('Signup successful. Role:', data.user.role);

      showStatus('Account created successfully! Redirecting...', 'success');

      // Redirect based on role
      setTimeout(() => {
        if (selectedRole === 'admin') {
          window.location.href = 'CityWatch-Admin-Dashboard.html';
        } else {
          window.location.href = 'CityWatch-User-Home.html';
        }
      }, 1500);

    } catch (error) {
      console.error('Signup error:', error);
      showStatus('Network error. Please check your connection and try again.', 'error');
    } finally {
      setLoading(signupBtn, false);
    }
  });
}


// Form validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Add real-time validation
document.getElementById('signup-email').addEventListener('blur', function() {
  if (this.value && !validateEmail(this.value)) {
    showStatus('Please enter a valid email address.', 'error');
  } else {
    hideStatus();
  }
});

document.getElementById('signup-confirm-password').addEventListener('input', function() {
  const password = document.getElementById('signup-password').value;
  if (this.value && this.value !== password) {
    this.style.borderColor = '#dc2626';
  } else {
    this.style.borderColor = '#e5e7eb';
  }
});

// Forgot password link now redirects to the reset password page

// Auto-focus first input
document.addEventListener('DOMContentLoaded', function() {
  const activeForm = document.querySelector('.form-section.active');
  const firstInput = activeForm.querySelector('input');
  if (firstInput) {
    firstInput.focus();
  }
});
