# 🇳🇬 NaijaPOS - Local Point of Sale System

A secure, offline-first POS system designed for Nigerian local businesses. Built with modern web technologies and Firebase backend.



## ✨ Features

- **🔐 Role-Based Access Control**: Separate Admin and Staff dashboards
- **📦 Inventory Management**: Add, edit, delete products with stock tracking
- **💰 Sales Terminal**: Quick product search and sales recording
- **📊 Sales History**: View sales by date with staff filtering
- **📄 PDF Reports**: Generate daily sales reports
- **🌙 Dark/Light Mode**: Easy on the eyes
- **📱 Responsive Design**: Works on all devices
- **⚡ Offline-First**: Built as a PWA for unreliable connections

## 🛡️ Security Features

Following the **"Vibecode Safely"** best practices:

- ✅ Firebase Authentication (Email/Password)
- ✅ Firestore Security Rules (Role-based access)
- ✅ XSS Protection (HTML sanitization)
- ✅ Input Validation (Server-side rules + client-side)
- ✅ Rate Limiting (Checkout abuse prevention)
- ✅ **Environment Variables** (Credentials never committed to Git)
- ✅ Pre-commit Security Checks (Automated scanning)
- ✅ Audit trail (Sales cannot be edited/deleted)

📖 **Security Guide**: See [SECURITY.md](SECURITY.md) and [ENV_SETUP.md](ENV_SETUP.md) for complete security documentation.

## 🚀 Quick Start

### Prerequisites
- A Firebase account ([console.firebase.google.com](https://console.firebase.google.com/))
- A modern web browser
- Basic text editor

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/naija-pos.git
   cd naija-pos
   ```

2. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable **Authentication** (Email/Password provider)
   - Enable **Cloud Firestore**
   - Enable **Firebase Storage** (optional, for product images)

3. **Configure Firebase Credentials** 🔐
   ```bash
   # Copy the environment template
   cp js/env.example.js js/env.js
   
   # Edit js/env.js with your Firebase credentials
   # Get these from: Firebase Console → Project Settings → Your Apps
   ```
   
   **Important**: The `js/env.js` file contains your actual credentials and is gitignored.  
   See [ENV_SETUP.md](ENV_SETUP.md) for detailed setup instructions.

4. **Deploy Security Rules**
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Login and initialize
   firebase login
   firebase init
   
   # Deploy rules
   firebase deploy --only firestore:rules,storage:rules
   ```

5. **Create Users**
   - In Firebase Console → Authentication → Add User
   - Admin users: Include "admin" in email (e.g., `admin@mybusiness.com`)
   - Staff users: Any other email (e.g., `john@mybusiness.com`)

6. **Run Locally**
   ```bash
   # Using the included script
   ./start-server.sh
   
   # Or with Python
   python3 -m http.server 8000
   
   # Or with Node.js
   npx serve
   ```

7. **Visit**: `http://localhost:8000`

## 📁 Project Structure

```
naija-pos/
├── index.html          # Main HTML file
├── css/
│   └── style.css       # Custom styles
├── js/
│   ├── app.js          # Main app logic, routing
│   ├── auth.js         # Authentication handling
│   ├── env.js          # 🔒 Firebase credentials (GITIGNORED)
│   ├── env.example.js  # Environment template
│   ├── firebase-config.js  # Firebase initialization
│   ├── inventory.js    # Admin inventory management
│   ├── sales.js        # Staff sales terminal
│   ├── admin-sales.js  # Admin sales history
│   └── security.js     # Security utilities (XSS, validation)
├── firestore.rules     # Firestore security rules
├── storage.rules       # Storage security rules
├── service-worker.js   # PWA offline support
├── .gitignore          # Git ignore (includes env.js)
├── pre-commit-check.sh # Security check script
├── safe-commit.sh      # Interactive safe commit tool
├── SECURITY.md         # Security policy
├── ENV_SETUP.md        # Environment setup guide
├── SAFE_COMMIT_GUIDE.md # Safe Git commit guide
└── README.md           # This file
```

## 📊 Firestore Collections

### `products`
```javascript
{
  name: string,
  price: number,
  stock: number,
  expiryDate: string (optional),
  createdAt: timestamp
}
```

### `sales`
```javascript
{
  items: [{ id, name, price, quantity }],
  total: number,
  timestamp: string,
  staffEmail: string,
  staffName: string,
  synced: boolean
}
```

### `users`
```javascript
{
  email: string,
  name: string,
  role: "Admin" | "Staff",
  createdAt: timestamp
}
```

## 🔒 Security Rules

See `firestore.rules` and `storage.rules` for detailed access control:

- **Products**: Authenticated users can read/update; only Admins can create/delete
- **Sales**: Authenticated users can create; only Admins can read; no edits/deletes allowed
- **Users**: Users can only access their own documents; Admins can read all

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **PDF Generation**: jsPDF + AutoTable
- **Offline**: Service Workers (PWA)


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Designed for Nigerian small businesses
- Inspired by the need for simple, secure POS solutions

