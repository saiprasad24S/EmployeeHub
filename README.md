# EmployeeHub

EmployeeHub is an employee attendance and tracking application with a Django backend and a React/Vite frontend.

## Run locally

### Backend

1. Install dependencies:
   ```bash
   python -m pip install -r backend/requirements.txt
   ```
2. Create a local `.env` file under `backend/` if needed.
3. Run database migrations:
   ```bash
   cd backend
   python manage.py migrate
   ```
4. Start the Django server:
   ```bash
   python manage.py runserver
   ```

The backend can be configured using either `DATABASE_URL` or explicit `DB_*` variables:

- `DATABASE_URL=mysql://user:password@host:port/dbname?ssl-mode=REQUIRED&ssl-ca=/path/to/ca.pem`
- or `DB_ENGINE=django.db.backends.mysql`, `DB_NAME=...`, `DB_USER=...`, `DB_PASSWORD=...`, `DB_HOST=...`, `DB_PORT=3306`, `DB_SSL_MODE=REQUIRED`, `DB_SSL_CA=/path/to/ca.pem`

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the app in the browser at the URL shown by Vite.

## Testing

### Backend tests

```bash
cd backend
python manage.py test
```

### Frontend tests

If the frontend project includes tests, run them from the `frontend` directory:

```bash
cd frontend
npm test
```

## Notes

- The backend supports MySQL/Aiven via `DATABASE_URL` or explicit `DB_*` environment variables.
- `face_recognition` is optional on Windows because `dlib` requires Visual C++ build tools; `insightface` is used automatically when unavailable.
- The frontend uses Clerk for authentication and expects Clerk environment variables configured in the frontend runtime.
