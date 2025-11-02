// Compute API base (support file:// open)
const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : '';

const statusMessage = document.getElementById('status-message');
const verifyForm = document.getElementById('verify-form');
const verifyBtn = document.getElementById('verify-btn');
const resendLink = document.getElementById('resend-code');

// Get email from URL params
const params = new URLSearchParams(window.location.search);
const email = params.get('email');

if (!email) {
  showStatus('No email provided. Please try signing up again.', 'error');
  verifyForm.style.display = 'none';
}

// Status message functions
function showStatus(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';
}

function hideStatus() {
  statusMessage.style.display = 'none';
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

// Handle form submission
verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideStatus();

  const code = Array.from(otpInputs).map(input => input.value).join('');
  if (code.length !== 6) {
    showStatus('Please enter the complete 6-digit code.', 'error');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || 'Verification failed. Please try again.', 'error');
      return;
    }

    showStatus('Email verified successfully! Redirecting to login...', 'success');
    
    // After successful verification, redirect to login
    setTimeout(() => {
      window.location.href = 'CityWatch-Login-New.html';
    }, 2000);

  } catch (error) {
    console.error('Verification error:', error);
    showStatus('Network error. Please try again.', 'error');
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify Email';
  }
});

// Handle resend code
resendLink.addEventListener('click', async (e) => {
  e.preventDefault();
  hideStatus();

  if (!email) {
    showStatus('No email provided. Please try signing up again.', 'error');
    return;
  }

  const originalText = resendLink.textContent;
  resendLink.textContent = 'Sending...';
  resendLink.style.pointerEvents = 'none';

  try {
    const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      showStatus(data.message || 'Failed to resend code. Please try again.', 'error');
      return;
    }

    showStatus('Verification code resent! Please check your email.', 'success');

    // Clear existing inputs
    otpInputs.forEach(input => input.value = '');
    otpInputs[0].focus();

  } catch (error) {
    console.error('Resend error:', error);
    showStatus('Network error. Please try again.', 'error');
  } finally {
    resendLink.textContent = originalText;
    resendLink.style.pointerEvents = '';
  }
});