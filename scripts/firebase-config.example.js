// Shape of scripts/firebase-config.js once a Banquet Bot Firebase project exists.
// Copy this over firebase-config.js (which is gitignored, never commit it) and paste the values from
// Firebase console > Project settings > Your apps > Web app > SDK setup and configuration.
// This is a Banquet Bot project. Do not reuse The Wire's project.
window.BB_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
  // appCheckSiteKey: "YOUR_RECAPTCHA_V3_SITE_KEY",  // add once App Check is on; omitted means App Check is skipped
  // disabled: true   // uncomment to force sample mode without removing the keys
};
