// ============================================================
//  CLOUD SYNC CONFIG  (so Hyebin's and Andrew's phones share data)
// ------------------------------------------------------------
//  The Firebase web config is not a secret — it ships in the page.
//  What protects your data is the Firestore security rules
//  (see SETUP-FIREBASE.md). Project: ha-workouts.
// ============================================================
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDR9HHnjbHxQTFzsvjqF34XznMDhfnEj4M",
  authDomain: "ha-workouts.firebaseapp.com",
  projectId: "ha-workouts",
  storageBucket: "ha-workouts.firebasestorage.app",
  messagingSenderId: "276312041231",
  appId: "1:276312041231:web:0afc02ab28c38eee7f407a",
  measurementId: "G-37QQP1V65J"
};
