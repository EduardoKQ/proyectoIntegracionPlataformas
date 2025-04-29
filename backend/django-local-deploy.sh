#!/bin/bash
# wait until we can connect to the database
echo "waiting database connection..."
python wait_for_db.py
# Check if the script exited successfully
if [ $db_status -ne 0 ]; then
  echo "Database connection check failed. Exiting."
  exit $db_status
fi

echo "Database is up, running migrations..."

# Run Django make migrations
echo "Running 'python manage.py makemigrations'..."
python manage.py makemigrations

# Run Django migrate
echo "Running 'python manage.py migrate'..."
python manage.py migrate

# load initial data (order of fixtures matters)
echo "Loading initial data..."
python manage.py loaddata users.json
python manage.py loaddata inventory.json
python manage.py loaddata products.json

# Run Django development server
echo "Starting Django development server on 0.0.0.0..."
python manage.py runserver 0.0.0.0:8000