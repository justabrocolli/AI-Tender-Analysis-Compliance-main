# AI Smart Tender Scraper & Manager

A robust Node.js backend application designed to automate the discovery, extraction, scoring, and notification of government or private tenders. This system uses AI to parse unstructured web data into structured JSON, scores opportunities based on your company profile, and manages user notifications.

## 🚀 Features

* **Automated Scraping Engine:** Configurable scraping cycles triggered by Cron schedules.
* **AI-Powered Extraction:** Uses OpenAI to intelligently extract tender details (IDs, Deadlines, Budgets, File Links) from raw HTML list views.
* **Smart Change Detection:** Implements hash-based monitoring (`MonitorService`) to check for website updates before launching full scraping cycles, saving AI tokens and resources.
* **Relevance Scoring:** Automatically scores incoming tenders (0-100) against a stored "Company Profile" to prioritize high-value opportunities.
* **Email Notifications:** Sends digest emails to users containing new, high-scoring tenders based on customizable thresholds.
* **Dynamic System Settings:** Manage target URLs, scraping schedules, downtime windows, and logging levels directly via the database/API without restarting the server.
* **Secure Authentication:** JWT-based authentication using HTTP-only cookies.
* **Robust Logging:** Detailed rotating file logs (`winston`) for application events and errors.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (Mongoose)
* **AI/LLM:** OpenAI API
* **Scheduling:** node-cron
* **Parsing:** Cheerio
* **Email:** Nodemailer
* **Logging:** Winston

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development_scrape  # Use 'production' for prod, 'development_scrape' to enable scrapers in dev
CLIENT_URL=http://localhost:5173 # URL of your frontend for CORS

# Database
MONGO_URI=mongodb://localhost:27017/tender-scraper

# Authentication
JWT_SECRET=your_super_secret_jwt_key

# AI Configuration (OpenAI)
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=[https://api.openai.com/v1](https://api.openai.com/v1) # Or a compatible proxy - defaults to https://api.openai.com/v1 if undefined
MODEL=gpt-5 # Or your preferred model

# Email Service (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=your_smtp_password

# Server Configuration
PORT=3000
CLIENT_URL=http://localhost:8080
MONGO_URI=
NODE_ENV=development
JWT_SECRET=
OPENAI_API_KEY=
MODEL=gpt-5
```
## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/tender-scraper.git](https://github.com/yourusername/tender-scraper.git)
    cd tender-scraper
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the server**
    ```bash
    # Development (with scraping module enabled via env)
    npm run dev

    # Production
    npm start
    ```

## 📡 API Endpoints

### Authentication (`/api/auth`)
* `POST /register` - Create a new user account.
* `POST /login` - Login and receive an HTTP-only JWT cookie.
* `POST /logout` - Clear the auth cookie.
* `GET /profile` - Get current user details.
* `PUT /profile` - Update user details and notification preferences.

### Tenders (`/api/tenders`)
* `GET /` - Retrieve tenders (Supports filters: `id`, `from`, `to`, `page`, `limit`).
* `POST /` - Manually create a tender.
* `PUT /:id` - Update an existing tender.
* `DELETE /:id` - Delete a tender.

### Settings (`/api/settings`)
* `GET /` - Retrieve current system configuration (schedules, target URLs, downtime).
* `PUT /` - Update system configuration (Admin only).
* `GET /logs` - View server logs (Admin only).

### System
* `GET /health` - Server health check.
* `GET /force-scrape` - Manually trigger the scraping cycle (bypassing the schedule).

## 📂 Project Structure

```text
├── models/             # Mongoose schemas (User, Tender, SystemSettings)
├── routes/             # Express route definitions
├── services/           # Business logic
│   ├── TenderManager.js       # Orchestrates the scraping cycle
│   ├── ScraperService.js      # AI-based discovery and enrichment
│   ├── MonitorService.js      # Hash-based site change detection
│   ├── ScoringService.js      # AI relevance scoring
│   └── NotificationService.js # Email dispatch
├── utils/              # Utilities (Logger)
├── middleware/         # Auth protection
└── index.js            # Entry point
```

## 📝 Logging

Logs are stored in the `/logs` directory using `winston-daily-rotate-file`.
* `application-YYYY-MM-DD.log`: Contains all logs (Info, Warn, Error).
* `error-YYYY-MM-DD.log`: Contains only errors for quick debugging.

* ## 🛡️ License & Copyright

**© 2026 [CityShob]. All Rights Reserved.**
