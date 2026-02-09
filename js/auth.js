/**
 * AUTHENTICATION MODULE
 * 
 * Handles login, logout, and password resets.
 */

import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const authError = document.getElementById('auth-error');
const editProfileBtn = document.getElementById('edit-profile-btn');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');

        const email = loginEmail.value;
        const password = loginPassword.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Login successful");
        } catch (error) {
            console.error("Login error:", error.code);
            authError.textContent = "Invalid email or password. Please try again.";
            authError.classList.remove('hidden');
        }
    });
}

const togglePasswordBtn = document.getElementById('toggle-password');
const eyeIcon = document.getElementById('eye-icon');
const eyeOffIcon = document.getElementById('eye-off-icon');

if (togglePasswordBtn && loginPassword && eyeIcon && eyeOffIcon) {
    togglePasswordBtn.addEventListener('click', () => {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);

        // Toggle icons
        if (type === 'text') {
            eyeIcon.classList.add('hidden');
            eyeOffIcon.classList.remove('hidden');
        } else {
            eyeIcon.classList.remove('hidden');
            eyeOffIcon.classList.add('hidden');
        }
    });
}

// --- Profile Management ---
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './firebase-config.js';

if (editProfileBtn) {
    editProfileBtn.addEventListener('click', async () => {
        if (editProfileBtn.disabled) return; // Prevent if locked

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        // Double check if already locked (client-side)
        const currentName = localStorage.getItem('userName') || '';

        if (!confirm("IMPORTANT: You can only set your name ONCE. It cannot be changed later.\n\nAre you sure you want to set your permanent name now?")) {
            return;
        }

        const newName = prompt("Enter your permanent full name:", currentName);

        if (newName && newName.trim() !== "" && newName !== currentName) {
            try {
                // Update Firestore
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, {
                    name: newName.trim()
                });

                // Update LocalStorage
                localStorage.setItem('userName', newName.trim());

                // Update UI
                // Update the badge immediately or just reload
                alert("Name locked successfully! Future sales will be recorded under: " + newName.trim());

                // Reload to reflect state (button will become locked)
                window.location.reload();
            } catch (error) {
                console.error("Error updating profile:", error);
                alert("Failed to update name: " + error.message);
            }
        }
    });
}
