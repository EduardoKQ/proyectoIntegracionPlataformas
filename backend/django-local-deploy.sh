#!/bin/bash

# Run Django make migrations
echo "Running 'python manage.py makemigrations'..."
python manage.py makemigrations

# Run Django migrate
echo "Running 'python manage.py migrate'..."
python manage.py migrate

# load initial data
echo "resetting database..."
python manage.py flush --no-input
echo "Loading initial data..."
python manage.py loaddata initial_data.json

# Run Django development server
echo "Starting Django development server on 0.0.0.0..."
python manage.py runserver 0.0.0.0:8000