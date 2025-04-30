import os
import sys
import time
import django
from django.db import connections
from django.db.utils import OperationalError

# Set up Django environment
# Assumes this script is in the same directory as manage.py or one level up/down
# Adjust the path based on your project structure if needed.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE", "backend_project.settings"
)  # Replace 'backend.settings' with your actual settings module path
django.setup()

db_conn = None
db_alias = "default"  # Use the database alias defined in your settings

print(f"Waiting for database '{db_alias}'...")

attempts = 0
max_attempts = 120  # Wait for max 30 seconds (adjust as needed)

while attempts < max_attempts:
    attempts += 1
    try:
        # Try to get a database connection cursor
        db_conn = connections[db_alias]
        db_conn.cursor()
        print(f"Database '{db_alias}' is available!")
        sys.exit(0)  # Exit successfully
    except OperationalError as e:
        print(f"Database unavailable (Attempt {attempts}/{max_attempts}): {e}")
        if attempts == max_attempts:
            print("Max attempts reached. Exiting.")
            sys.exit(1)  # Exit with error
        time.sleep(2)  # Wait for 2 second before retrying
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)  # Exit with error

# Should not be reached if loop exits normally
sys.exit(1)
