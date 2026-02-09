/**
 * SECURITY UTILITIES
 * 
 * Following the "VIBECODE SAFELY" guide:
 * - Sanitize ALL user input
 * - Prevent XSS, injection attacks
 * - Validate data before use
 */

/**
 * Sanitizes a string to prevent XSS attacks
 * Escapes HTML special characters
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string safe for HTML rendering
 */
export function sanitizeHTML(str) {
    if (typeof str !== 'string') {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return str.replace(/[&<>"'`=\/]/g, (s) => map[s]);
}

/**
 * Validates and sanitizes product name
 * @param {string} name - Product name to validate
 * @returns {object} - { valid: boolean, value: string, error: string }
 */
export function validateProductName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, value: '', error: 'Product name is required' };
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        return { valid: false, value: '', error: 'Product name cannot be empty' };
    }

    if (trimmed.length > 200) {
        return { valid: false, value: '', error: 'Product name must be 200 characters or less' };
    }

    // Check for suspicious patterns (SQL injection attempts, script tags)
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /UNION\s+SELECT/i,
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /INSERT\s+INTO/i,
        /--/,
        /\/\*/
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(trimmed)) {
            return { valid: false, value: '', error: 'Invalid characters in product name' };
        }
    }

    return { valid: true, value: trimmed, error: '' };
}

/**
 * Validates a positive number (for price, stock, etc.)
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {object} - { valid: boolean, value: number, error: string }
 */
export function validatePositiveNumber(value, fieldName = 'Value') {
    const num = parseFloat(value);

    if (isNaN(num)) {
        return { valid: false, value: 0, error: `${fieldName} must be a number` };
    }

    if (num < 0) {
        return { valid: false, value: 0, error: `${fieldName} cannot be negative` };
    }

    if (!isFinite(num)) {
        return { valid: false, value: 0, error: `${fieldName} is invalid` };
    }

    return { valid: true, value: num, error: '' };
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Validates date format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return true; // Empty dates are valid (optional field)
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return false;
    }

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

/**
 * Rate limiter for client-side actions
 * Helps prevent spam/abuse
 */
export class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 60000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.attempts = [];
    }

    canAttempt() {
        const now = Date.now();
        // Remove old attempts outside the window
        this.attempts = this.attempts.filter(t => now - t < this.windowMs);

        if (this.attempts.length >= this.maxAttempts) {
            return false;
        }

        this.attempts.push(now);
        return true;
    }

    getRemainingTime() {
        if (this.attempts.length === 0) return 0;
        const oldestAttempt = Math.min(...this.attempts);
        const remaining = this.windowMs - (Date.now() - oldestAttempt);
        return Math.max(0, Math.ceil(remaining / 1000));
    }
}

// Export a global rate limiter for checkout operations
export const checkoutRateLimiter = new RateLimiter(10, 60000); // 10 checkouts per minute max
