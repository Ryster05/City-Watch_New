// Toggle password visibility
const toggles = document.querySelectorAll(".toggle-password");

toggles.forEach(toggle => {
  toggle.addEventListener("click", () => {
    const inputId = toggle.getAttribute("data-target");
    const input = document.getElementById(inputId);

    // Toggle input type
    const type = input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);

    // Toggle icon style
    toggle.classList.toggle("bx-show");
    toggle.classList.toggle("bx-hide");
  });
});

// Password match check
const form = document.querySelector("form");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");

// Create error message span
const errorMsg = document.createElement("small");
errorMsg.style.color = "red";
errorMsg.style.display = "none";
errorMsg.textContent = "Passwords do not match.";
confirmPassword.insertAdjacentElement("afterend", errorMsg);

form.addEventListener("submit", (e) => {
  if (password.value !== confirmPassword.value) {
    e.preventDefault();
    errorMsg.style.display = "block";
    return;
  }
  errorMsg.style.display = "none";
});

// Compute API base (works when opened from filesystem too)
const API_BASE = (location.origin === 'null' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : '';

// Handle signup submit
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (password.value !== confirmPassword.value) return; // guarded above

    const name = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const pw = password.value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pw, role: 'user' })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Signup failed. Please try again.');
        return;
      }

      // Redirect to verification page with email
      window.location.href = `CityWatch-Verify-Email.html?email=${encodeURIComponent(email)}`;
    } catch (err) {
      alert(`Network error: ${err?.message || err}`);
    }
  });
}
