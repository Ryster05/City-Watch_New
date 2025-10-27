// Compute API base (support file:// open)
const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : '';

const form = document.getElementById('report-form');
const submitBtn = document.getElementById('submit-btn');
const statusMessage = document.getElementById('status-message');

function showStatus(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }
}

function hideStatus() {
  statusMessage.style.display = 'none';
}

function getToken() {
  return localStorage.getItem('cw_token');
}

function isLoggedIn() {
  return !!getToken();
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.textContent = loading ? 'Submitting...' : 'Submit';
}

// Check if user is logged in and update UI accordingly
function updateUIForAuthStatus() {
  const loggedIn = isLoggedIn();
  
  // You could add different styling or messaging here
  // For now, we'll use the same form for both authenticated and anonymous users
}

// Initialize UI based on auth status
updateUIForAuthStatus();

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();
    setLoading(true);

    try {
      const formData = new FormData();
      
      // Get form values
  // Read values: title is a hidden compatibility field; category is the select
  const titleEl = document.getElementById('title');
  const title = titleEl ? titleEl.value.trim() : '';
  const description = document.getElementById('description').value.trim();
  const locationSelect = document.getElementById('location');
  const location = locationSelect ? locationSelect.value.trim() : '';
  const locationOtherEl = document.getElementById('location-other');
  const photoInput = document.getElementById('photo');
  const photo = photoInput && photoInput.files ? photoInput.files[0] : null;
  const categorySel = document.getElementById('category');
  const category = categorySel ? categorySel.value : '';

      // Derive title from category if not provided (for non-'others' selections)
  if ((!title || title.length === 0) && category && category !== 'other'){
        // Map machine value to friendly label when possible
        const friendly = (v)=>{
          return {
            'road-and-traffic':'Road and Traffic',
            'waste-management':'Waste Management',
            'flooding-and-drainage':'Flooding and Drainage',
            'public-safety':'Public Safety',
            'utilities':'Utilities',
            'other':'Other'
          }[v] || v;
        };
        if (titleEl) titleEl.value = friendly(category);
      }

      // Re-read title after possible derivation
      const finalTitle = (document.getElementById('title') && document.getElementById('title').value.trim()) || '';
      // Validate required fields
      if (!finalTitle) {
        showStatus('Please enter a title for your report.', 'error');
        setLoading(false);
        return;
      }

      if (!description) {
        showStatus('Please enter a description of the issue.', 'error');
        setLoading(false);
        return;
      }

      // Validate location selection
      if (!location) {
        showStatus('Please select a location for the report.', 'error');
        setLoading(false);
        return;
      }

      // If user selected 'Other', ensure they provided the text
      if (location === 'Other') {
        if (!locationOtherEl || !locationOtherEl.value.trim()) {
          showStatus('Please specify the location when "Other" is selected.', 'error');
          setLoading(false);
          return;
        }
      }

      // Validate photo
      if (!photo) {
        showStatus('Please attach a photo to support your report.', 'error');
        setLoading(false);
        return;
      }

      // Add form data
  formData.append('title', finalTitle);
  formData.append('description', description);
  // send category value (machine-friendly) and also a friendly title
  if (category) formData.append('category', category);
  else formData.append('category', 'other');
      formData.append('priority', 'medium'); // Default priority
      
      // Use locationOtherEl value when 'Other' is chosen
      if (location === 'Other' && locationOtherEl && locationOtherEl.value.trim()) {
        formData.append('address', locationOtherEl.value.trim());
      } else if (location) {
        formData.append('address', location);
      }
      
      if (photo) {
        formData.append('photo', photo);
      }

      // Determine endpoint and headers based on authentication
      const token = getToken();
      let endpoint = '/api/reports/anonymous';
      let headers = {};

      if (token) {
        // User is logged in, use authenticated endpoint
        endpoint = '/api/reports';
        headers = { 'Authorization': `Bearer ${token}` };
      } else {
        // Anonymous submission - add optional reporter info
        const reporterName = prompt('Your name (optional):');
        const reporterEmail = prompt('Your email (optional):');
        
        if (reporterName) {
          formData.append('reporterName', reporterName);
        }
        if (reporterEmail) {
          formData.append('reporterEmail', reporterEmail);
        }
      }

      showStatus('Submitting your report...', 'info');

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const responseText = await response.text();
      let data = null;
      
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
      }

      if (!response.ok) {
        const errorMessage = (data && data.message) || responseText || `Failed to submit report (${response.status})`;
        showStatus(errorMessage, 'error');
        setLoading(false);
        return;
      }

      // Success!
      const referenceNumber = data.report?.referenceNumber || 'N/A';
      showStatus(
        `Report submitted successfully! Your reference number is: ${referenceNumber}.`,
        'success'
      );

      // Reset form and show success view
      form.reset();
      // clear file input and reset upload button UI
      if (fileInput) {
        try { fileInput.value = ''; } catch(e) { /* some browsers restrict programmatic clear but it's okay */ }
        // reset upload button appearance
        if (fileUploadButton) {
          fileUploadButton.innerHTML = `<i class='bx bx-cloud-upload'></i> Add file`;
          fileUploadButton.style.backgroundColor = '#f3f4f6';
          fileUploadButton.style.color = '#2563eb';
          fileUploadButton.style.borderColor = '#d1d5db';
        }
      }
  // hide form card and submit button area, show success panel
  const formCard = document.querySelector('.form-card');
  const actionArea = document.querySelector('.action-buttons');
  const successPanel = document.getElementById('report-success');
  const mainTitle = document.querySelector('.main-title');
  if (formCard) formCard.style.display = 'none';
  if (actionArea) actionArea.style.display = 'none';
  if (successPanel) successPanel.style.display = 'block';
  if (mainTitle) mainTitle.style.display = 'none';

      // store reference number in the success panel for potential use
      successPanel.setAttribute('data-ref', referenceNumber);

    } catch (error) {
      console.error('Submission error:', error);
      showStatus(`Network error: ${error.message || 'Please check your connection and try again.'}`, 'error');
    } finally {
      setLoading(false);
    }
  });
}

// Add some interactivity to the file upload button
const fileInput = document.getElementById('photo');
const fileUploadButton = document.querySelector('.file-upload-button');

if (fileInput && fileUploadButton) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Update button text to show selected file
      const fileName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
      fileUploadButton.innerHTML = `<i class='bx bx-check'></i> ${fileName}`;
      fileUploadButton.style.backgroundColor = '#dcfce7';
      fileUploadButton.style.color = '#166534';
      fileUploadButton.style.borderColor = '#bbf7d0';
    } else {
      // Reset button text
      fileUploadButton.innerHTML = `<i class='bx bx-cloud-upload'></i> Add file`;
      fileUploadButton.style.backgroundColor = '#f3f4f6';
      fileUploadButton.style.color = '#2563eb';
      fileUploadButton.style.borderColor = '#d1d5db';
    }
  });
}

// Add smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add form validation feedback
const inputs = document.querySelectorAll('.form-input');
inputs.forEach(input => {
  input.addEventListener('blur', function() {
    if (this.hasAttribute('required') && !this.value.trim()) {
      this.style.borderColor = '#dc2626';
    } else {
      this.style.borderColor = '#d1d5db';
    }
  });

  input.addEventListener('input', function() {
    if (this.style.borderColor === 'rgb(220, 38, 38)') {
      this.style.borderColor = '#d1d5db';
    }
  });
});

// Success panel actions: Go to My Reports (track) or Back to form
document.addEventListener('DOMContentLoaded', () => {
  const goto = document.getElementById('goto-reports');
  const back = document.getElementById('back-to-form');
  const successPanel = document.getElementById('report-success');
  const formCard = document.querySelector('.form-card');
  const actionArea = document.querySelector('.action-buttons');

  if (goto) goto.addEventListener('click', (e) => {
    e.preventDefault();
    // navigate to track reports page
    window.location.href = 'CityWatch-Track.html';
  });

    if (back) back.addEventListener('click', (e) => {
    e.preventDefault();
    // hide success panel and show form again
    if (successPanel) successPanel.style.display = 'none';
    if (formCard) formCard.style.display = 'block';
    if (actionArea) actionArea.style.display = 'flex';
    const mainTitle = document.querySelector('.main-title');
    if (mainTitle) mainTitle.style.display = 'block';
    // scroll to form top
    window.scrollTo({ top: 0, behavior: 'smooth' });
      // Also clear the photo input when returning to the form
      if (fileInput) {
        try { fileInput.value = ''; } catch(e) {}
      }
      if (fileUploadButton) {
        fileUploadButton.innerHTML = `<i class='bx bx-cloud-upload'></i> Add file`;
        fileUploadButton.style.backgroundColor = '#f3f4f6';
        fileUploadButton.style.color = '#2563eb';
        fileUploadButton.style.borderColor = '#d1d5db';
      }
  });
});
