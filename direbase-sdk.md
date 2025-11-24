// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBqFKw6v6RB0P1HHup9jO10Cziqfnuiig4",
  authDomain: "bitarcade-679b7.firebaseapp.com",
  projectId: "bitarcade-679b7",
  storageBucket: "bitarcade-679b7.firebasestorage.app",
  messagingSenderId: "163469341654",
  appId: "1:163469341654:web:f5e231834fa4426a396a77",
  measurementId: "G-F8S6MFN276"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
