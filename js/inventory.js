/**
 * INVENTORY MODULE
 * 
 * Handles adding, editing, and deleting products.
 * Connects to Firestore for real-time updates.
 * NO IMAGE UPLOAD - Keeping it simple and free!
 * 
 * Security: Uses sanitizeHTML to prevent XSS attacks
 */

import { db } from './firebase-config.js';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sanitizeHTML, validateProductName, validatePositiveNumber } from './security.js';

const inventoryList = document.getElementById('inventory-list');
const addProductBtn = document.getElementById('add-product-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const inventorySearchInput = document.querySelector('#admin-dashboard input[placeholder="Search products..."]');

let allInventoryProducts = [];

// --- Real-time Inventory Listener ---
export function initInventoryListener() {
    const q = query(collection(db, "products"), orderBy("name"));

    onSnapshot(q, (snapshot) => {
        allInventoryProducts = [];
        snapshot.forEach((doc) => {
            allInventoryProducts.push({ id: doc.id, ...doc.data() });
        });
        renderInventory(allInventoryProducts);
        updateInventoryStats(allInventoryProducts);
    });

    // Setup search functionality
    if (inventorySearchInput) {
        inventorySearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            if (searchTerm === '') {
                renderInventory(allInventoryProducts);
            } else {
                const filtered = allInventoryProducts.filter(p =>
                    p.name.toLowerCase().includes(searchTerm)
                );
                renderInventory(filtered);
            }
        });
    }
}

function updateInventoryStats(products) {
    const lowStockCountEl = document.getElementById('low-stock-count');
    const expiredCountEl = document.getElementById('expired-count');

    if (!lowStockCountEl || !expiredCountEl) return;

    let lowStock = 0;
    let expired = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    products.forEach(p => {
        // Low Stock: < 10
        if (p.stock < 10) {
            lowStock++;
        }

        // Expired
        if (p.expiryDate) {
            const expiry = new Date(p.expiryDate);
            expiry.setHours(0, 0, 0, 0); // normalize
            if (expiry < today) {
                expired++;
            }
        }
    });

    lowStockCountEl.textContent = lowStock;
    expiredCountEl.textContent = expired;
}

function renderInventory(products) {
    inventoryList.innerHTML = '';
    if (products.length === 0) {
        inventoryList.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No products found</td></tr>';
        return;
    }

    products.forEach((product) => {
        renderProductRow(product.id, product);
    });
}

function renderProductRow(id, product) {
    const row = document.createElement('tr');
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";

    // Sanitize product name to prevent XSS
    const safeName = sanitizeHTML(product.name);
    const safeExpiryDate = sanitizeHTML(product.expiryDate || 'N/A');

    row.innerHTML = `
        <td class="px-6 py-4 font-medium">${safeName}</td>
        <td class="px-6 py-4">
            <span class="${product.stock < 10 ? 'text-red-500 font-bold' : ''}">${parseInt(product.stock, 10)}</span>
        </td>
        <td class="px-6 py-4">₦${parseFloat(product.price).toLocaleString()}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${safeExpiryDate}</td>
        <td class="px-6 py-4">
            <button data-action="edit" data-id="${id}" class="text-indigo-600 hover:text-indigo-900 mr-3 font-medium">Edit</button>
            <button data-action="delete" data-id="${id}" data-name="${safeName}" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
        </td>
    `;

    // Use event delegation for better security (no inline onclick)
    row.querySelector('[data-action="edit"]').addEventListener('click', () => editProduct(id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProduct(id, product.name));

    inventoryList.appendChild(row);
}

// --- Add Product Modal ---
if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
        showAddProductModal();
    });
}

function showAddProductModal() {
    modalContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">Add New Product</h3>
        <form id="add-product-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1">Product Name</label>
                <input type="text" id="p-name" required class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Stock Quantity</label>
                    <input type="number" id="p-stock" required min="0" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Price (₦)</label>
                    <input type="number" id="p-price" required min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Expiry Date (Optional)</label>
                <input type="date" id="p-expiry" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
            </div>
            <div class="flex justify-end space-x-3 mt-6">
                <button type="button" id="close-modal" class="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">Save Product</button>
            </div>
        </form>
    `;

    modalOverlay.classList.remove('hidden');

    document.getElementById('close-modal').onclick = () => modalOverlay.classList.add('hidden');

    document.getElementById('add-product-form').onsubmit = async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            // Enhanced validation using security utilities
            const nameValidation = validateProductName(document.getElementById('p-name').value);
            if (!nameValidation.valid) {
                throw new Error(nameValidation.error);
            }

            const stockValidation = validatePositiveNumber(document.getElementById('p-stock').value, 'Stock');
            if (!stockValidation.valid) {
                throw new Error(stockValidation.error);
            }

            const priceValidation = validatePositiveNumber(document.getElementById('p-price').value, 'Price');
            if (!priceValidation.valid) {
                throw new Error(priceValidation.error);
            }

            const newProduct = {
                name: nameValidation.value,
                stock: Math.floor(stockValidation.value), // Ensure integer for stock
                price: priceValidation.value,
                expiryDate: document.getElementById('p-expiry').value,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, "products"), newProduct);
            modalOverlay.classList.add('hidden');
        } catch (error) {
            console.error("Error adding product:", error);
            alert("Error adding product: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Product';
        }
    };
}

// --- Edit Product Modal ---
window.editProduct = async (productId) => {
    const product = allInventoryProducts.find(p => p.id === productId);
    if (!product) return;

    modalContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">Edit Product</h3>
        <form id="edit-product-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium mb-1">Product Name</label>
                <input type="text" id="e-name" required value="${product.name}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Stock Quantity</label>
                    <input type="number" id="e-stock" required min="0" value="${product.stock}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Price (₦)</label>
                    <input type="number" id="e-price" required min="0" step="0.01" value="${product.price}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Expiry Date</label>
                <input type="date" id="e-expiry" value="${product.expiryDate || ''}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
            </div>
            <div class="flex justify-end space-x-3 mt-6">
                <button type="button" id="close-modal" class="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" class="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">Update Product</button>
            </div>
        </form>
    `;

    modalOverlay.classList.remove('hidden');

    document.getElementById('close-modal').onclick = () => modalOverlay.classList.add('hidden');

    document.getElementById('edit-product-form').onsubmit = async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        try {
            // Enhanced validation using security utilities
            const nameValidation = validateProductName(document.getElementById('e-name').value);
            if (!nameValidation.valid) {
                throw new Error(nameValidation.error);
            }

            const stockValidation = validatePositiveNumber(document.getElementById('e-stock').value, 'Stock');
            if (!stockValidation.valid) {
                throw new Error(stockValidation.error);
            }

            const priceValidation = validatePositiveNumber(document.getElementById('e-price').value, 'Price');
            if (!priceValidation.valid) {
                throw new Error(priceValidation.error);
            }

            const updatedProduct = {
                name: nameValidation.value,
                stock: Math.floor(stockValidation.value),
                price: priceValidation.value,
                expiryDate: document.getElementById('e-expiry').value
            };

            const productRef = doc(db, "products", productId);
            await updateDoc(productRef, updatedProduct);
            modalOverlay.classList.add('hidden');
        } catch (error) {
            console.error("Error updating product:", error);
            alert("Error updating product: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Product';
        }
    };
};

// --- Delete Product ---
window.deleteProduct = async (productId, productName) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await deleteDoc(doc(db, "products", productId));
        console.log("Product deleted successfully");
    } catch (error) {
        console.error("Error deleting product:", error);
        alert("Error deleting product: " + error.message);
    }
};
