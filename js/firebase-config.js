/* =====================================================
   EduArchive Portal — Firebase Configuration
   Project: eduarchive-portal
   ===================================================== */

// Import Firebase SDKs (compat version for CDN use)
// These are loaded via <script> tags in HTML, so we just configure here.

const firebaseConfig = {
  apiKey: "AIzaSyB1QU1cPh3foS5wc_X7sbU1AS430eBmFcI",
  authDomain: "eduarchive-3ac31.firebaseapp.com",
  projectId: "eduarchive-3ac31",
  storageBucket: "eduarchive-3ac31.firebasestorage.app",
  messagingSenderId: "802694406643",
  appId: "1:802694406643:web:62b4dd538dbd92921df286",
  measurementId: "G-YYV3KJ2LV3"
};

// Initialize Firebase (compat SDK — globally available after CDN scripts)
firebase.initializeApp(firebaseConfig);

// Export service handles to global scope for use by all page scripts
window.fbAuth    = firebase.auth();
window.fbDb      = firebase.firestore();

// Enable Firestore offline persistence (not supported on file://)
if (window.location.protocol !== 'file:') {
  window.fbDb.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence: not supported in this browser.');
      }
    });
} else {
  console.info('Firestore persistence disabled for local file view.');
}

console.log('%c🔥 Firebase connected — eduarchive-3ac31', 'color:#6c63ff;font-weight:bold');
