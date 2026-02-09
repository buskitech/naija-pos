/**
 * SALES MODULE
 * 
 * Handles product search, cart management, and checkout.
 * Implements local-first logic for sales recording.
 * Tracks staff information for each sale.
 * NO IMAGE UPLOAD - Keeping it simple and free!
 * 
 * Security: Uses sanitizeHTML to prevent XSS, rate limiting to prevent abuse
 */

import { db, auth } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sanitizeHTML, checkoutRateLimiter } from './security.js';

let cart = [];
let allProducts = [];

// --- Initialize Sales Terminal ---
export function initSalesTerminal() {
    console.log('Initializing sales terminal...');

    const productGrid = document.getElementById('product-grid');
    const productSearch = document.getElementById('product-search');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (!productGrid || !productSearch || !checkoutBtn) {
        console.error('Sales terminal elements not found!');
        return;
    }

    // Load products
    const q = query(collection(db, "products"), orderBy("name"));

    onSnapshot(q, (snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        renderProductGrid(allProducts);
    });

    // Setup checkout button - CRITICAL FIX
    // Remove any existing event listeners by cloning
    const newCheckoutBtn = checkoutBtn.cloneNode(true);
    checkoutBtn.parentNode.replaceChild(newCheckoutBtn, checkoutBtn);

    // Add event listener to the new button
    newCheckoutBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        console.log('Checkout button clicked!');
        await handleCheckout();
    });

    console.log('Checkout button listener attached successfully');

    // Setup search functionality
    productSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term === '') {
            renderProductGrid(allProducts);
        } else {
            const filtered = allProducts.filter(p =>
                p.name.toLowerCase().includes(term)
            );
            renderProductGrid(filtered);
        }
    });
}

function renderProductGrid(products) {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;

    productGrid.innerHTML = '';

    if (products.length === 0) {
        productGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No products available</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-500 transition-all";

        // Sanitize product name to prevent XSS
        const safeName = sanitizeHTML(product.name);

        card.innerHTML = `
            <div class="w-full h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-lg mb-2 flex items-center justify-center">
                <span class="text-2xl">📦</span>
            </div>
            <h4 class="font-bold text-sm truncate">${safeName}</h4>
            <p class="text-indigo-600 font-bold mt-1">₦${parseFloat(product.price).toLocaleString()}</p>
            <p class="text-xs text-gray-500 mt-1">Stock: ${parseInt(product.stock, 10)}</p>
        `;
        card.onclick = () => addToCart(product);
        productGrid.appendChild(card);
    });
}

// --- Cart Logic ---
function addToCart(product) {
    if (product.stock <= 0) {
        alert("Out of stock!");
        return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < product.stock) {
            existingItem.quantity++;
        } else {
            alert("Cannot exceed available stock");
        }
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalDisplay = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (!cartItemsContainer || !cartTotalDisplay || !checkoutBtn) return;

    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Cart is empty</p>';
        checkoutBtn.disabled = true;
    } else {
        checkoutBtn.disabled = false;
        cart.forEach((item, index) => {
            total += item.price * item.quantity;
            const itemEl = document.createElement('div');
            itemEl.className = "flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg";

            // Sanitize item name for display
            const safeName = sanitizeHTML(item.name);

            itemEl.innerHTML = `
                <div class="flex-1">
                    <p class="text-sm font-medium">${safeName}</p>
                    <p class="text-xs text-gray-500">₦${parseFloat(item.price).toLocaleString()} x ${item.quantity}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button data-index="${index}" data-action="decrease" class="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500">-</button>
                    <span class="text-sm font-bold">${item.quantity}</span>
                    <button data-index="${index}" data-action="increase" class="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500">+</button>
                </div>
            `;

            // Add event listeners to buttons
            const decreaseBtn = itemEl.querySelector('[data-action="decrease"]');
            const increaseBtn = itemEl.querySelector('[data-action="increase"]');

            decreaseBtn.addEventListener('click', () => updateQty(index, -1));
            increaseBtn.addEventListener('click', () => updateQty(index, 1));

            cartItemsContainer.appendChild(itemEl);
        });
    }

    cartTotalDisplay.textContent = `₦${total.toLocaleString()}`;
}

// Cart quantity update function
function updateQty(index, change) {
    const item = cart[index];
    if (change === -1 && item.quantity === 1) {
        cart.splice(index, 1);
    } else if (change === 1) {
        if (item.quantity < item.stock) {
            item.quantity++;
        } else {
            alert("Cannot exceed available stock");
        }
    } else {
        item.quantity += change;
    }
    renderCart();
}

// --- Checkout Logic ---
async function handleCheckout() {
    console.log('handleCheckout called, cart:', cart);

    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }

    // Rate limiting check to prevent abuse
    if (!checkoutRateLimiter.canAttempt()) {
        const waitTime = checkoutRateLimiter.getRemainingTime();
        alert(`Too many checkouts. Please wait ${waitTime} seconds before trying again.`);
        return;
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    if (!checkoutBtn) return;

    // Disable button to prevent double submission
    checkoutBtn.disabled = true;
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Processing...';

    try {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Get staff information from localStorage and auth
        const staffEmail = localStorage.getItem('userEmail') || auth.currentUser?.email || 'Unknown';
        const staffName = localStorage.getItem('userName') || staffEmail.split('@')[0];

        console.log('Staff info:', { staffEmail, staffName });

        // Validate that we have staff information
        if (!staffEmail || staffEmail === 'Unknown') {
            throw new Error('Unable to identify staff member. Please log in again.');
        }

        const saleData = {
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            total: total,
            timestamp: new Date().toISOString(),
            staffEmail: staffEmail,
            staffName: staffName,
            synced: true
        };

        console.log('Sale data:', saleData);

        // Validate sale data
        if (saleData.total <= 0) {
            throw new Error('Invalid sale total');
        }

        // 1. Record the sale
        console.log('Recording sale...');
        await addDoc(collection(db, "sales"), saleData);
        console.log('Sale recorded successfully');

        // 2. Update stock for each item
        console.log('Updating stock...');
        for (const item of cart) {
            const productRef = doc(db, "products", item.id);
            await updateDoc(productRef, {
                stock: increment(-item.quantity)
            });
        }
        console.log('Stock updated successfully');

        // Show success popup instead of alert
        showSuccessModal(total, staffName);

        cart = [];
        renderCart();

        // Reset button
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = true; // Will be enabled when cart has items
    } catch (error) {
        console.error("Checkout error:", error);

        // More detailed error message
        let errorMsg = "Error completing sale: " + error.message;

        if (error.code === 'permission-denied') {
            errorMsg = "Permission denied! Please check:\n\n1. You are logged in\n2. Firestore rules are deployed correctly\n\nGo to Firebase Console → Firestore Database → Rules and publish the rules.";
        }

        alert(errorMsg);

        // Re-enable button on error
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = originalText;
    }
}

function showSuccessModal(total, staffName) {
    const popup = document.getElementById('success-popup');
    const message = document.getElementById('success-popup-message');
    const closeBtn = document.getElementById('success-popup-close');
    const popupContent = popup.querySelector('div');

    if (!popup || !message || !closeBtn) return;

    message.innerHTML = `
        Total: <span class="font-bold text-gray-900 dark:text-white">₦${total.toLocaleString()}</span><br>
        Sold by: <span class="font-medium text-indigo-600 dark:text-indigo-400">${staffName}</span>
    `;

    popup.classList.remove('hidden');
    // Small delay to allow display block to apply before opacity transition
    setTimeout(() => {
        popupContent.classList.remove('scale-95', 'opacity-0');
        popupContent.classList.add('scale-100', 'opacity-100');
    }, 10);

    const closeHandler = () => {
        popupContent.classList.remove('scale-100', 'opacity-100');
        popupContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 300);
        closeBtn.removeEventListener('click', closeHandler);
    };

    closeBtn.addEventListener('click', closeHandler);
}
