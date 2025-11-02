import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');

// Load existing env
let envConfig = {};
try {
  if (fs.existsSync(envPath)) {
    envConfig = dotenv.parse(fs.readFileSync(envPath));
  }
} catch (err) {
  console.error('Error reading .env:', err);
}

// Update email config
const emailConfig = {
  EMAIL_HOST: 'smtp.gmail.com',
  EMAIL_PORT: '587',
  EMAIL_SECURE: 'false',
  EMAIL_USER: process.argv[2], // First arg is Gmail address
  EMAIL_PASS: process.argv[3], // Second arg is App Password
  EMAIL_FROM: `"City Watch <${process.argv[2]}>"`
};

// Preserve other env vars but update email ones
const newConfig = { ...envConfig, ...emailConfig };

// Write updated env
const envContent = Object.entries(newConfig)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(envPath, envContent);
console.log('Updated .env with Gmail SMTP settings');