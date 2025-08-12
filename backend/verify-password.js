const bcrypt = require('bcryptjs');

const password = '@Abcd6789';
const hash = '$2a$12$m52OogB/ct6pTsv9lYNXWOtTufbGYpzdBzhnKm3qK.t4A2k9uYDG.';

// Verify the hash
bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password match:', result);
  }
});

// Generate a new hash to verify
bcrypt.hash(password, 12, (err, newHash) => {
  if (err) {
    console.error('Error generating hash:', err);
  } else {
    console.log('New hash:', newHash);
    
    // Verify the new hash
    bcrypt.compare(password, newHash, (err, result) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('New hash verification:', result);
      }
    });
  }
});