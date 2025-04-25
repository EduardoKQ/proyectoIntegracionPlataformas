echo "Stopping containers and removing volumes (including database)..."
docker-compose down -v

echo "Building and starting services..."
docker-compose up --build -d

echo "Services started. Check logs inside Docker Desktop."