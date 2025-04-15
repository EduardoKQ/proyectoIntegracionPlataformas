# Local Deployment (development)


This document describes how to set up and run the project locally for development purposes using Docker Desktop on a Windows machine.

Project structure

```
- backend: Django REST Framework APIs
- devops: Deployment and utility scripts (CI/CD pipeline in the future)
- frontend: Angular app
- tests (to implement)
```

## Prerequisites

Before you begin, ensure you have the following installed and running on your Windows system:

1.  **Git:** For cloning the repository. ([Download Git](https://git-scm.com/download/win))
2.  **Docker Desktop for Windows:** Ensure it is running and configured to use the Linux container backend (this is usually the default). ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))

## Getting Started

Follow these steps to get your local development environment running:

**1. Clone the Repository:**

Open Git Bash, PowerShell, or Command Prompt and clone the project:

```bash
git clone https://github.com/EduardoKQ/proyectoIntegracionPlataformas.git
cd proyectoIntegracionPlataformas
```

**2. Change Backend secret key**

Optional, but good practice. Open dev.env file inside backend folder and change the secret key. The longer the secret key, more secure it is.

```
# Django setting
SECRET_KEY='use_another_key_please_its_good_practice'
DEBUG=True
...
...
...
```

**3. Build and Start Containers**

From the root folder you need to execute docker compose that's inside devops folder. You can execute it like this:
```
docker compose up --build -d 
```

This command builds and deploys frontend, backend and db containers. Each container installs all its dependencies and runs all the code they need, so we don't need to install anything.

To apply changes made to Dockerfiles or some other configuration, or to rebuild after errors, simply run the docker compose up --build -d command again.

**4. Verify the Setup**

All containers should be running without errors. Check Docker Desktop to see all running containers (frontend, backend and db)

- Verify the frontend is accessible at http://localhost:4200
- Verify the backend health check responds at http://localhost:8100

## Links
Once the setup is complete, the services are accessible via:

- frontend: http://localhost:4200
- backend: http://localhost:8100
- db: http://localhost:3307

We can connect to the MySQL database using a tool like MySQL Workbench or DBeaver on port 3307. These are the testing credentials:
```
environment:
      MYSQL_DATABASE: webapp_db
      MYSQL_USER: webapp_user
      MYSQL_PASSWORD: webapp_password
      MYSQL_ROOT_PASSWORD: 'root123123' # testing only
```

## Dev notes

- **Hot Reloading**: The local deployment structure supports hot reloading for both frontend and backend code. Changes saved in the frontend or backend directories on your machine will automatically trigger a reload or restart within the respective container, speeding up development. You usually just need to refresh your browser to see frontend changes.

## signatures

- Nelson Alfaro
- Eduardo Kusar