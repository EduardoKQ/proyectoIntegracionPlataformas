FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install Angular CLI globally inside the container (optional but can be useful)
RUN npm install -g @angular/cli

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code into the container
# Note: We will use a volume in docker-compose to overwrite this with local code for hot-reloading
COPY . .

# Expose port 4200 for the Angular development server
EXPOSE 4200

# Command to run the Angular development server
# --host 0.0.0.0 makes it accessible from outside the container
# --poll is often needed for change detection to work reliably in Docker, especially on Windows hosts
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "1000"]