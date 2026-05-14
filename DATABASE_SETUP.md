# Database Setup & Seeding Guide

## Problem Summary
The application was showing "Failed to load live data" and "Failed to load executive summary" errors because:
1. The database had no seed data
2. The API endpoints were not returning any data
3. Missing `faker` dependency for seed data generation

## Solution

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

This installs all required packages including the newly added `faker` library needed for generating realistic test data.

### Step 2: Configure Database Connection

#### Option A: Using Neon PostgreSQL (Recommended for Production)
1. Create a `.env` file in the project root:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
DATABASE_URL=postgresql://user:password@host:port/database_name
```

#### Option B: Using Local PostgreSQL
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kicowasco_db
```

#### Option C: Using SQLite (Development Only)
The default Django SQLite database will be used if no DATABASE_URL is set.

### Step 3: Run Setup & Seeding

**Automatic Setup (Recommended):**
```bash
python setup_and_seed.py
```

This script will:
- Run all database migrations
- Create an admin user (username: `admin`, password: `admin123`)
- Seed 90 days of realistic operational data

**Manual Setup:**
```bash
# Run migrations
python kicowasco/manage.py migrate

# Create superuser
python kicowasco/manage.py createsuperuser

# Seed database
python kicowasco/manage.py seed_db
```

### Step 4: Verify Data Loading

Start the development server:
```bash
python kicowasco/manage.py runserver
```

Then check:
1. **Dispatch Board**: http://localhost:8000/dashboard/dispatch
   - Should show incident data
2. **Executive Summary**: http://localhost:8000/dashboard/summary
   - Should show monthly KPIs with data
3. **API Endpoints**:
   - Incidents: http://localhost:8000/api/incidents/
   - Lab Records: http://localhost:8000/api/lab-records/
   - Summary: http://localhost:8000/api/summary/?year=2026&month=5

## What Gets Seeded

The `seed_db` command creates:
- **1 Company**: Kirinyaga County Water & Sanitation PLC
- **6 Users**: Various roles (superintendent, supervisor, technician, operator, etc.)
- **90 Days of Data**:
  - Treatment logs with BOD/TSS parameters
  - Sludge collection manifests (2-5 per day)
  - Weekly sewer line patrols
  - Pond daily logs
  - Lab records with influent/effluent parameters
  - Incidents and repairs (1-2 per day)
  - Exhauster fleet data

## Troubleshooting

### "Failed to load live data" Error
**Cause**: Database connection issue or no data exists
**Solution**:
1. Check `.env` file has correct DATABASE_URL
2. Verify database is running and accessible
3. Run migrations: `python kicowasco/manage.py migrate`
4. Run seed command: `python kicowasco/manage.py seed_db`

### "Failed to load executive summary" Error
**Cause**: `/api/summary/` endpoint not returning data
**Solution**:
1. Ensure DailyLabRecord data exists: 
   ```bash
   python kicowasco/manage.py shell
   >>> from core.models import DailyLabRecord
   >>> DailyLabRecord.objects.count()
   ```
2. If count is 0, run seed_db again
3. Check API response: `curl http://localhost:8000/api/summary/?year=2026&month=5`

### "ModuleNotFoundError: No module named 'faker'"
**Solution**: Install missing dependency
```bash
pip install faker==24.0.0
```

### Database Lock Issues
If you get "database is locked" errors with SQLite:
1. Delete `db.sqlite3` file
2. Run migrations again: `python kicowasco/manage.py migrate`
3. Run seed_db: `python kicowasco/manage.py seed_db`

## Neon Database Specific Notes

If using Neon PostgreSQL:
1. No special setup needed beyond DATABASE_URL
2. Connection pooling is handled automatically
3. Migrations run normally
4. Seed data can be large (90 days × multiple tables) - may take 1-2 minutes

## API Endpoints Available After Seeding

- `GET /api/incidents/` - All incidents
- `GET /api/lab-records/` - Lab records (supports ?year=&month= filters)
- `GET /api/summary/?year=2026&month=5` - Monthly summary
- `GET /api/pond-logs/` - Pond daily logs
- `GET /api/patrols/` - Weekly line patrols
- `GET /api/sludge/` - Sludge collection manifests
- `GET /api/users/` - User list

## Next Steps

1. **Frontend**: Ensure frontend is pointing to correct API URL
   - Check `frontend/src/api/axios.js` baseURL
   - Should be `http://localhost:8000` for local dev
   - Or your Render/Vercel backend URL for production

2. **Authentication**: Login with seeded users
   - Username: `Sarah`, Password: `kicowasco123` (Superintendent)
   - Username: `Peter`, Password: `kicowasco123` (Supervisor)
   - Username: `Kevin`, Password: `kicowasco123` (Line Attendant)

3. **Production Deployment**:
   - Set `DEBUG=False` in .env
   - Use Neon PostgreSQL with proper DATABASE_URL
   - Run migrations on deployment
   - Seed data is optional (can use admin panel to add data)
