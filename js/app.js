/**
 * MAIN APPLICATION LOGIC
 * 
 * This file handles the general UI behavior, theme switching,
 * and coordinates between different modules.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initInventoryListener } from './inventory.js';
import { initSalesTerminal } from './sales.js';

// --- UI Elements ---
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

const authSection = document.getElementById('auth-section');
const adminDashboard = document.getElementById('admin-dashboard');
const staffDashboard = document.getElementById('staff-dashboard');
const userNav = document.getElementById('user-nav');
const userRoleBadge = document.getElementById('user-role-badge');
const logoutBtn = document.getElementById('logout-btn');

// --- Loading State Management ---
let isAuthChecking = true;

// Show loading overlay initially
document.body.insertAdjacentHTML('afterbegin', `
    <div id="auth-loading" class="fixed inset-0 bg-white dark:bg-gray-900 z-[100] flex items-center justify-center">
        <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    </div>
`);

// --- Theme Management ---
function initTheme() {
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        themeToggleLightIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleDarkIcon.classList.remove('hidden');
    }
}

themeToggleBtn.addEventListener('click', function () {
    themeToggleDarkIcon.classList.toggle('hidden');
    themeToggleLightIcon.classList.toggle('hidden');

    if (localStorage.getItem('color-theme')) {
        if (localStorage.getItem('color-theme') === 'light') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        }
    } else {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('color-theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('color-theme', 'dark');
        }
    }
});

// --- Auth State Observer ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        console.log("User logged in:", user.email);
        await handleUserRouting(user);
    } else {
        // User is signed out
        showSection('auth');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
    }

    // Remove loading overlay after auth check
    const loadingEl = document.getElementById('auth-loading');
    if (loadingEl) {
        loadingEl.remove();
    }
    isAuthChecking = false;
});

async function handleUserRouting(user) {
    try {
        // Check if user has a role in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        let role = 'Staff';
        let userName = user.email.split('@')[0];
        let nameIsSet = false;

        if (userDoc.exists()) {
            const userData = userDoc.data();
            role = userData.role || 'Staff';
            userName = userData.name || userName;
            // Check if name has been explicitly set (and is different from email default)
            // Or use a specific flag if you prefer, but strict persistence implies
            // if they have a name in DB that is not just the default email-based one.
            // For simplicity, we assume if it's in DB, it's set. 
            // Better: Check if the user document has a specific 'nameSet' flag or just rely on if name exists.
            if (userData.name) {
                nameIsSet = true;
            }
        } else {
            // Create user document if it doesn't exist
            // Determine role based on email (admin if contains 'admin')
            role = user.email.includes('admin') ? 'Admin' : 'Staff';
            await setDoc(userDocRef, {
                email: user.email,
                name: userName, // Default name from email
                role: role,
                createdAt: new Date().toISOString()
            });
        }

        // Store user info in localStorage for quick access
        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', userName);
        localStorage.setItem('userEmail', user.email);

        userRoleBadge.textContent = role;
        userNav.classList.remove('hidden');

        // Manage Edit Profile Button
        const editProfileBtn = document.getElementById('edit-profile-btn');
        if (editProfileBtn) {
            if (role === 'Admin') {
                // Admin: Hide button completely
                editProfileBtn.classList.add('hidden');
            } else {
                // Staff: Check if name is already permanent
                if (nameIsSet) {
                    // Name is set, lock it
                    editProfileBtn.innerHTML = `
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                    `;
                    editProfileBtn.title = "Name is permanent";
                    editProfileBtn.style.cursor = "not-allowed";
                    // Remove click listener logic (handled in auth.js via check) or disable
                    editProfileBtn.disabled = true;
                } else {
                    // Name not set, allow edit
                    editProfileBtn.classList.remove('hidden');
                    editProfileBtn.disabled = false;
                    editProfileBtn.style.cursor = "pointer";
                    editProfileBtn.title = "Set your permanent name";
                }
            }
        }

        if (role === 'Admin') {
            showSection('admin');
            initInventoryListener();
        } else {
            showSection('staff');
            initSalesTerminal();
        }
    } catch (error) {
        console.error("Error handling user routing:", error);
        // Fallback...
        const isAdmin = user.email.includes('admin');
        const role = isAdmin ? 'Admin' : 'Staff';

        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', user.email.split('@')[0]);
        localStorage.setItem('userEmail', user.email);

        userRoleBadge.textContent = role;
        userNav.classList.remove('hidden');

        const editProfileBtn = document.getElementById('edit-profile-btn');
        if (editProfileBtn) editProfileBtn.classList.add('hidden'); // Fallback: hide to be safe

        if (isAdmin) {
            showSection('admin');
            initInventoryListener();
        } else {
            showSection('staff');
            initSalesTerminal();
        }
    }
}

function showSection(section) {
    authSection.classList.add('hidden');
    adminDashboard.classList.add('hidden');
    staffDashboard.classList.add('hidden');
    userNav.classList.add('hidden');

    if (section === 'auth') {
        authSection.classList.remove('hidden');
    } else if (section === 'admin') {
        adminDashboard.classList.remove('hidden');
        userNav.classList.remove('hidden');
    } else if (section === 'staff') {
        staffDashboard.classList.remove('hidden');
        userNav.classList.remove('hidden');
    }
}

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        window.location.reload();
    });
});

// Initialize
initTheme();
