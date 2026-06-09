# Text Scan Insight (MERN Stack)

Welcome to the **Text Scan Insight** repository. This project is a full-stack MERN (MongoDB, Express, React, Node.js) application that features Optical Character Recognition (OCR) powered by `tesseract.js`. 

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:
- **[Node.js](https://nodejs.org/en/download/)** (v18 or higher recommended)
- **[MongoDB](https://www.mongodb.com/try/download/community)** (Ensure you have a local MongoDB server running, or have a MongoDB URI ready)
- **Git**

## Step-by-Step Installation

### 1. Clone the Repository
Open your terminal and clone the repository using:
```bash
git clone <YOUR_GIT_URL>
cd text-scan-insight
```

### 2. Install Dependencies
This project is a monorepo containing both the `frontend` and `backend` directories. We use a root script to manage both seamlessly.

First, install the root dependencies (like `concurrently`):
```bash
npm install
```

Next, install all inner dependencies for both the frontend and backend simultaneously:
```bash
npm run install:all
```
*(Alternatively, you can manually `cd` into both the `frontend` and `backend` folders and run `npm install` in each).*

### 3. Configure Environment Variables
Before running the application, you **must** configure your environment variables for the backend. 

Navigate to the `backend` directory and create a file named `.env`:
```bash
cd backend
type nul > .env
```
*(On Mac/Linux, you can use `touch .env` instead)*

Open the `.env` file using your code editor and add the following required configurations:
```env
# backend/.env

PORT=5000
# Base MongoDB connection string (update if using MongoDB Atlas)
MONGO_URI=mongodb://localhost:27017/text-scan-insight
# Secure key for jsonwebtoken
JWT_SECRET=your_super_secret_jwt_key_change_in_production
```

*(Note: Ensure your local MongoDB server is actually running in the background before proceeding).*

### 4. Running the Project
Navigate back to the **root** directory of the project (`text-scan-insight`), and run our designated startup command:

```bash
cd ..
npm run dev
```

This single command will:
1. Start your backend Node.js Express server on `http://localhost:5000` (using standard `nodemon` hot-reloading).
2. Start your frontend React server on the Vite development port.

You can now open your browser and navigate to the frontend URL printed in the terminal by Vite to view the application!

<!-- Git Contributors Cache Trigger -->
