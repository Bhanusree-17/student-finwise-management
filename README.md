# StudentSpace — FinWise-inspired Student Management System

Full-stack Node.js + Express + MySQL application with:
- Admin signup, login, logout (bcrypt password hashing and session authentication)
- Dashboard overview cards and department distribution
- Student CRUD (create, read, update, delete)
- Department filters and search by name, roll number or email
- Department listing, reports, settings
- Responsive dark dashboard inspired by the FinWise UI

## Run locally
1. Install Node.js (LTS) and MySQL Server.
2. Extract the project and open the folder containing `package.json` in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env`, then enter your MySQL credentials and a strong `SESSION_SECRET`.
5. Ensure MySQL is running.
6. Run `npm start`.
7. Open http://localhost:3000 and create an admin account.

The server creates the database and tables if they do not exist. If your MySQL user cannot create databases, create `student_management` manually and grant the user access.

## Deploy on Render
Push this folder to a GitHub repository, then create a Render Web Service from that repository.
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables from `.env` in Render.
- Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` to a reachable hosted MySQL-compatible service. `localhost` will not work for an external Render service.
- Set a long random `SESSION_SECRET`.
- Use HTTPS and a persistent external MySQL database. Configure database network access to allow the Render service.

Render does not provide a universally available free managed MySQL database. Use a MySQL-compatible host that supports your deployment plan. Do not commit `.env` or credentials to GitHub.

## Notes
This is a practical starter application. For production, configure a persistent session store (instead of Express MemoryStore), rate limiting, backups, and stronger account recovery.
