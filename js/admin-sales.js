/**
 * ADMIN SALES HISTORY MODULE
 * 
 * Handles displaying sales history in the admin dashboard
 * with staff filtering and tracking capabilities.
 * 
 * Security: Uses sanitizeHTML to prevent XSS attacks
 */

import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sanitizeHTML } from './security.js';

const salesList = document.getElementById('sales-list');
const staffFilter = document.getElementById('staff-filter');

let allSales = [];
let uniqueStaff = new Set();

// Initialize sales listener when admin dashboard is visible
export function initAdminSalesListener() {
    const q = query(collection(db, "sales"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        allSales = [];
        uniqueStaff.clear();

        snapshot.forEach((doc) => {
            const sale = { id: doc.id, ...doc.data() };
            allSales.push(sale);

            // Track unique staff members
            if (sale.staffName) {
                uniqueStaff.add(sale.staffName);
            }
        });

        updateStaffFilter();
        renderSales(allSales);
        updateTotalSalesToday(allSales);
    });

    // Setup filter event listener
    if (staffFilter) {
        staffFilter.addEventListener('change', (e) => {
            const selectedStaff = e.target.value;
            if (selectedStaff === '') {
                renderSales(allSales);
            } else {
                const filtered = allSales.filter(sale => sale.staffName === selectedStaff);
                renderSales(filtered);
            }
        });
    }

    // Setup download listener (PDF with Date Selection)
    const downloadBtn = document.getElementById('download-sales-btn');
    if (downloadBtn) {
        // Clone to remove old listeners
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);

        newDownloadBtn.addEventListener('click', () => {
            showDownloadDateSelectionModal(allSales);
        });
    }
}

function showDownloadDateSelectionModal(sales) {
    if (!sales || sales.length === 0) {
        alert("No sales data available.");
        return;
    }

    // Extract unique dates
    const dates = new Set();
    sales.forEach(sale => {
        const dateStr = new Date(sale.timestamp).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
        dates.add(dateStr);
    });

    const uniqueDates = Array.from(dates).sort((a, b) => new Date(b) - new Date(a)); // Sort desc

    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    const optionsHtml = uniqueDates.map(date => `<option value="${date}">${date}</option>`).join('');

    modalContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">Download Sales Report</h3>
        <p class="text-sm text-gray-500 mb-4">Select a date to generate the PDF report.</p>
        
        <div class="mb-6">
            <label class="block text-sm font-medium mb-1">Select Date</label>
            <select id="report-date-select" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent">
                ${optionsHtml}
            </select>
        </div>

        <div class="flex justify-end space-x-3">
            <button id="close-report-modal" class="px-4 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
            <button id="generate-pdf-btn" class="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700">
                Download PDF
            </button>
        </div>
    `;

    modalOverlay.classList.remove('hidden');

    document.getElementById('close-report-modal').onclick = () => modalOverlay.classList.add('hidden');

    document.getElementById('generate-pdf-btn').onclick = () => {
        const selectedDateStr = document.getElementById('report-date-select').value;
        generateDailyReportPDF(selectedDateStr, sales);
        modalOverlay.classList.add('hidden');
    };
}

function generateDailyReportPDF(dateStr, allSales) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Filter sales for the selected date
    const salesForDate = allSales.filter(sale => {
        const sDate = new Date(sale.timestamp).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
        return sDate === dateStr;
    });

    // Sort by time
    salesForDate.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Calculate totals
    const totalAmount = salesForDate.reduce((sum, s) => sum + s.total, 0);

    // --- PDF Header ---
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo color
    doc.text("NaijaPOS", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Daily Sales Report", 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Date: ${dateStr}`, 14, 40);
    doc.text(`Generated: ${new Date().toLocaleString('en-NG')}`, 14, 45);

    // --- Table Data ---
    const tableData = salesForDate.map(sale => {
        const time = new Date(sale.timestamp).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });

        // Sanitize items for PDF
        const items = sale.items ? sale.items.map(i => `${sanitizeHTML(i.name)} (${parseInt(i.quantity, 10)})`).join(', ') : 'N/A';

        return [
            time,
            sanitizeHTML(sale.staffName || 'Unknown'),
            items,
            `N${parseFloat(sale.total).toLocaleString()}`
        ];
    });

    // --- Table Generation ---
    doc.autoTable({
        startY: 55,
        head: [['Time', 'Staff', 'Items Sold', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' }, // Items description gets remaining space
            3: { cellWidth: 35, halign: 'right' }
        }
    });

    // --- Grand Total ---
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Grand Total:", 140, finalY);
    doc.setTextColor(22, 163, 74); // Green color
    doc.text(`N${totalAmount.toLocaleString()}`, 195, finalY, { align: 'right' });

    // Save
    // Convert date string to filename friendly format
    const safeDate = dateStr.replace(/,/g, '').replace(/ /g, '_');
    doc.save(`Sales_Report_${safeDate}.pdf`);
}

function updateTotalSalesToday(sales) {
    const totalSalesElement = document.getElementById('total-sales-today');
    if (!totalSalesElement) return;

    const today = new Date();
    const todayString = today.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

    // Filter sales for today
    const todaysSales = sales.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        const saleDateString = saleDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
        return saleDateString === todayString;
    });

    const total = todaysSales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    totalSalesElement.textContent = `₦${total.toLocaleString()}`;
}

function updateStaffFilter() {
    if (!staffFilter) return;

    // Keep the "All Staff" option and add unique staff members
    const currentValue = staffFilter.value;
    staffFilter.innerHTML = '<option value="">All Staff</option>';

    Array.from(uniqueStaff).sort().forEach(staffName => {
        const option = document.createElement('option');
        option.value = staffName;
        option.textContent = staffName;
        staffFilter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue && uniqueStaff.has(currentValue)) {
        staffFilter.value = currentValue;
    }
}

function renderSales(sales) {
    if (!salesList) return;

    salesList.innerHTML = '';

    if (sales.length === 0) {
        salesList.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">No sales recorded yet</td></tr>';
        return;
    }

    // Calculate daily totals map
    const dailyTotals = {};
    sales.forEach(sale => {
        const dateString = new Date(sale.timestamp).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!dailyTotals[dateString]) dailyTotals[dateString] = 0;
        dailyTotals[dateString] += parseFloat(sale.total);
    });

    let lastDateString = '';

    sales.forEach((sale, index) => {
        // Date Grouping Logic
        const date = new Date(sale.timestamp);
        const dateString = date.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (dateString !== lastDateString) {
            const headerRow = document.createElement('tr');
            headerRow.className = "bg-gray-100 dark:bg-gray-750 border-t border-b border-gray-200 dark:border-gray-600";
            headerRow.innerHTML = `
                <td colspan="4" class="px-6 py-2 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                    ${dateString}
                </td>
            `;
            salesList.appendChild(headerRow);
            lastDateString = dateString;
        }

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0";

        // Format date/time
        const formattedTime = date.toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Get items summary - sanitize for display
        const itemCount = sale.items ? sale.items.length : 0;
        const itemsSummary = sale.items ? sale.items.map(item => `${sanitizeHTML(item.name)} (${parseInt(item.quantity, 10)})`).join(', ') : 'N/A';
        const safeStaffName = sanitizeHTML(sale.staffName || 'Unknown');
        const safeItemsSummary = sanitizeHTML(itemsSummary);

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="text-sm font-medium">${formattedTime}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    ${safeStaffName}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm">${itemCount} item(s)</div>
                <div class="text-xs text-gray-500 truncate max-w-xs" title="${safeItemsSummary}">${safeItemsSummary}</div>
            </td>
            <td class="px-6 py-4 font-bold text-green-600">
                ₦${parseFloat(sale.total).toLocaleString()}
            </td>
        `;

        // Add click handler to show sale details
        row.onclick = () => showSaleDetails(sale);

        salesList.appendChild(row);

        // Check for end of date group
        let isLastItemOfDay = false;
        if (index === sales.length - 1) {
            isLastItemOfDay = true;
        } else {
            const nextSale = sales[index + 1];
            const nextDate = new Date(nextSale.timestamp);
            const nextDateString = nextDate.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (nextDateString !== dateString) {
                isLastItemOfDay = true;
            }
        }

        if (isLastItemOfDay) {
            const totalRow = document.createElement('tr');
            totalRow.className = "bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-600";
            totalRow.innerHTML = `
                <td colspan="3" class="px-6 py-3 text-right font-bold text-gray-700 dark:text-gray-300">
                    Total for ${dateString}:
                </td>
                <td class="px-6 py-3 font-extrabold text-green-700 dark:text-green-400 text-lg">
                    ₦${dailyTotals[dateString].toLocaleString()}
                </td>
            `;
            salesList.appendChild(totalRow);
        }
    });
}

function showSaleDetails(sale) {
    const date = new Date(sale.timestamp);
    const formattedDateTime = date.toLocaleString('en-NG');

    // Sanitize sale details for display
    const itemsHtml = sale.items.map(item => `
        <div class="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span>${sanitizeHTML(item.name)} x ${parseInt(item.quantity, 10)}</span>
            <span class="font-medium">₦${(parseFloat(item.price) * parseInt(item.quantity, 10)).toLocaleString()}</span>
        </div>
    `).join('');

    const safeStaffName = sanitizeHTML(sale.staffName || 'Unknown');
    const safeStaffEmail = sanitizeHTML(sale.staffEmail || '');

    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = `
        <h3 class="text-xl font-bold mb-4">Sale Details</h3>
        <div class="space-y-3">
            <div>
                <p class="text-sm text-gray-500">Date & Time</p>
                <p class="font-medium">${formattedDateTime}</p>
            </div>
            <div>
                <p class="text-sm text-gray-500">Staff Member</p>
                <p class="font-medium">${safeStaffName}</p>
                <p class="text-xs text-gray-400">${safeStaffEmail}</p>
            </div>
            <div>
                <p class="text-sm text-gray-500 mb-2">Items Sold</p>
                ${itemsHtml}
            </div>
            <div class="pt-3 border-t-2 border-gray-200 dark:border-gray-600">
                <div class="flex justify-between items-center">
                    <span class="text-lg font-bold">Total</span>
                    <span class="text-2xl font-bold text-green-600">₦${parseFloat(sale.total).toLocaleString()}</span>
                </div>
            </div>
        </div>
        <div class="flex justify-end mt-6">
            <button id="close-modal" class="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
        </div>
    `;

    modalOverlay.classList.remove('hidden');

    document.getElementById('close-modal').onclick = () => {
        modalOverlay.classList.add('hidden');
    };
}

// Auto-initialize when the script loads
// The function will only work when the admin dashboard is visible
setTimeout(() => {
    const adminDashboard = document.getElementById('admin-dashboard');
    if (adminDashboard && !adminDashboard.classList.contains('hidden')) {
        initAdminSalesListener();
    }

    // Also listen for when admin dashboard becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'admin-dashboard' && !mutation.target.classList.contains('hidden')) {
                initAdminSalesListener();
                observer.disconnect(); // Only initialize once
            }
        });
    });

    if (adminDashboard) {
        observer.observe(adminDashboard, { attributes: true, attributeFilter: ['class'] });
    }
}, 1000);
