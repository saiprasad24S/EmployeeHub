#!/bin/bash
set -e

cd "$(dirname "$0")"

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

echo "======================================"
echo "Starting EmployeeHub deployment..."
echo "======================================"
echo ""

echo "1. Fetching latest code..."
git fetch origin main

echo ""
echo "2. Resetting to origin/main..."
git reset --hard origin/main

echo ""
echo "3. Removing untracked non-ignored files..."
git clean -fd

echo ""
echo "4. Installing backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "5. Running Django system checks..."
python manage.py check

echo ""
echo "6. Collecting static files..."
python manage.py collectstatic --noinput

echo ""
echo "7. Installing frontend dependencies..."
cd ../frontend
npm ci

echo ""
echo "8. Building frontend..."
npm run build

echo ""
echo "9. Checking frontend build output..."
if [ -f dist/index.html ]; then
    echo "Frontend build check: OK"
else
    echo "Frontend build check: FAILED"
    exit 1
fi

echo ""
echo "10. Restarting EmployeeHub backend..."
sudo systemctl restart employeehub

echo ""
echo "11. Checking backend service..."
if sudo systemctl is-active --quiet employeehub; then
    echo "Backend service check: OK"
else
    echo "Backend service check: FAILED"
    exit 1
fi

echo ""
echo "12. Checking backend health..."

HEALTH_OK=false

for attempt in {1..10}; do
    echo "Health check attempt $attempt/10..."

    if curl --fail --silent --show-error http://127.0.0.1:8001/ > /tmp/employeehub_health.json; then
        HEALTH_OK=true
        break
    fi

    echo "Backend not ready yet. Waiting 2 seconds..."
    sleep 2
done

if [ "$HEALTH_OK" = true ]; then
    echo "Backend health check: OK"
    cat /tmp/employeehub_health.json
    rm -f /tmp/employeehub_health.json
else
    echo "Backend health check: FAILED after 10 attempts"
    rm -f /tmp/employeehub_health.json
    exit 1
fi

echo ""
echo "======================================"
echo "EmployeeHub deployment completed!"
echo "======================================"