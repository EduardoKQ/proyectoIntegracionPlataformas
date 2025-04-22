FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1 # Prevents python from writing pyc files
ENV PYTHONUNBUFFERED 1       # Prevents python from buffering stdout/stderr

# Set work directory
WORKDIR /app

# Install system dependencies (like build tools for mysqlclient)
# Use apt-get for Debian/Ubuntu based images (like python:*-slim)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY . .

# Expose port 8000 for the Django app
EXPOSE 8000

# Run Django development server
CMD ["sh", "django-local-deploy.sh"]