# Ferremas Project

This repository contains the source code for the Ferremas application, including the frontend, backend, API definitions, and deployment configurations.

Authors:
- Nelson Alfaro
- Kevin Soto
- Eduardo Kusar

## Project Structure

The repository is organized into the following main directories:

*   [`api/`](api/): Contains the OpenAPI specification ([`api/ferremas.yaml`](api/ferremas.yaml)) and related files like the Swagger UI ([`api/swagger/index.html`](api/swagger/index.html)). See [`api/README.md`](api/README.md).
*   [`backend/`](backend/): Contains the Python/Django backend application. See [`backend/README.md`](backend/README.md) for setup and execution details.
*   `db/`: Intended for database-related files
*   [`devops/`](devops/): Contains Docker configurations ([`devops/docker-compose.yml`](devops/docker-compose.yml)) and other deployment-related files.
*   [`docs/`](docs/): Contains project documentation and guides
*   [`frontend/`](frontend/): Contains the Angular frontend application. See [`frontend/README.md`](frontend/README.md) for setup and execution details.
*   [`tests/`](tests/): Contains acceptance and unit tests for the project.

## Development Workflow

The typical development workflow follows these steps:

1.  Select an User Story to develop.
2.  Make a new branch, for example "feature/login"
3.  Develop!
    1.  Define or update the API contract in [`api/ferremas.yaml`](api/ferremas.yaml).
    2.  Verify the API docs changes using the Swagger UI ([`api/swagger/index.html`](api/swagger/index.html)) (open it using Live Server)
    3.  (Optional) Use Prism or similar tools to mock the new API endpoints for frontend development. You can create manual mockups as .json files instead
    4.  Implement the corresponding frontend logic in the [`frontend/`](frontend/) application.
    5.  Implement the required server-side logic for the API in the [`backend/`](backend/) application.
4.  Commit the changes

## Getting Started

1.  **Local Setup:** Follow the instructions in the [Local Development Deployment Guide](docs/local_dev_deploy.md).