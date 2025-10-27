// Compute API base (support file:// open)
const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : '';

const statusMessage = document.getElementById('status-message');
const emailSection = document.getElementById('email-section');
const otpSection = document.getElementById('otp-section');
const passwordSection = document.getElementById('password-section');
const emailForm = document.getElementById('email-form');
const otpForm = document.getElementById('otp-form');
const passwordForm = document.getElementById('password-form');

let resetToken = '';  // Store the reset token from the API
let resetEmail = '';  // Store the email being reset

// Status message functions
function showStatus(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';
}

function hideStatus() {
  statusMessage.style.display = 'none';
}

function showSection(sectionId) {
  [emailSection, otpSection, passwordSection].forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
}

// Handle OTP input fields
const otpInputs = document.querySelectorAll('.otp-inputs input');
otpInputs.forEach((input, index) => {
  // Auto-focus next input
  input.addEventListener('input', () => {
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });

  // Handle backspace
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });

  // Ensure only numbers
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '');
  });
});

// Email form submission
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideStatus();

  const email = document.getElementById('reset-email').value.trim();
  if (!email) {
    showStatus('Please enter your email address.', 'error');
    return;
  }

  const button = document.getElementById('send-otp-btn');
  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const resp = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      showStatus(data.message || 'Failed to send OTP.', 'error');
      return;
    }

    // Store email for later use
    resetEmail = email;

    // For development: show the token (in production this would be emailed)
    if (data.token) {
      resetToken = data.token;
      showStatus('Dev mode: Token received. In production this would be emailed.', 'info');
    } else {
      showStatus('OTP sent! Please check your email.', 'success');
    }

    // Switch to OTP section
    showSection('otp-section');
  } catch (err) {
    console.error('Send OTP error:', err);
    showStatus('Network error. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Send OTP';
  }
});

  // OTP form submission
otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideStatus();

  // Get the reset token from OTP inputs
  resetToken = Array.from(otpInputs).map(input => input.value).join('');
  if (resetToken.length !== 6) {
    showStatus('Please enter the complete 6-digit code.', 'error');
    return;
  }

  // Move to password reset section
  showSection('password-section');
});

// Password form submission
passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideStatus();

  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    showStatus('Passwords do not match.', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showStatus('Password must be at least 6 characters long.', 'error');
    return;
  }

  const button = document.getElementById('reset-password-btn');
  button.disabled = true;
  button.textContent = 'Resetting...';

  try {
    const resp = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      showStatus(data.message || 'Failed to reset password.', 'error');
      return;
    }

    showStatus('Password reset successful! Redirecting to login...', 'success');
    setTimeout(() => {
      window.location.href = 'CityWatch-Login-New.html';
    }, 2000);
  } catch (err) {
    console.error('Reset password error:', err);
    showStatus('Network error. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Reset Password';
  }
});

// Auto-focus first OTP input when OTP section becomes active
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.classList.contains('active') && mutation.target.id === 'otp-section') {
      otpInputs[0].focus();
    }
  });
});

observer.observe(otpSection, { attributes: true });