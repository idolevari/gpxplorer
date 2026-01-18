# GPXplorer

GPXplorer is a modern web application for viewing GPX files on interactive maps. It features a React-based frontend using Mapbox GL and a robust Python FastAPI backend.

## Features

- **Interactive Map**: View GPX tracks on a beautiful Mapbox map.
- **Trip Details**: View information about your trips.
- **Download**: Export GPX files directly from the application.
- **Modern UI**: Built with TailwindCSS for a sleek, responsive design.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, Mapbox GL JS
- **Backend**: Python, FastAPI, Uvicorn
- **Deployment**: Netlify (Frontend), Railway (Backend)

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (v3.11+)
- Mapbox API Token

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd gpxplorer
    ```

2.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install
    cp .env.example .env
    # Add your VITE_MAPBOX_TOKEN in .env
    npm run dev
    ```

3.  **Backend Setup:**
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

## Deployment

- **Frontend**: configured for Netlify via `netlify.toml`.
- **Backend**: configured for Railway using `Dockerfile`.
