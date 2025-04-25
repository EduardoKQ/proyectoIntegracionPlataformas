Write-Host "Stopping containers and removing volumes (including database)..."
docker-compose down -v

Write-Host "Building and starting services..."
docker-compose up --build -d

Write-Host "Services started. Check logs inside Docker Desktop."