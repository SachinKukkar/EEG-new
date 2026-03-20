#!/usr/bin/env python3
"""
Production startup script for EEG API.

This script ensures proper configuration for production deployment on Render.
It validates environment, sets up logging, and starts the Uvicorn server.

Usage:
    python start.py
    # or via Render:
    python start.py --render

Environment Variables:
    PORT: Server port (auto-set by Render)
    ENVIRONMENT: deployment environment (production/development)
    CORS_ORIGINS: Comma-separated allowed origins
"""

import os
import sys
import logging
from pathlib import Path

# Setup logging early
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
)
logger = logging.getLogger("eeg-startup")


def validate_environment():
    """Validate critical environment configuration."""
    logger.info("=" * 80)
    logger.info("EEG API Production Startup")
    logger.info("=" * 80)
    
    env = os.getenv("ENVIRONMENT", "development")
    logger.info(f"Environment: {env}")
    
    # Check required directories
    root = Path(__file__).parent
    assets_dir = root / "assets"
    data_dir = root / "data"
    
    logger.info(f"Project root: {root}")
    logger.info(f"Assets dir exists: {assets_dir.exists()}")
    logger.info(f"Data dir exists: {data_dir.exists()}")
    
    # Check model
    model_path = assets_dir / "model.pth"
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        logger.info(f"Model file found: {size_mb:.2f} MB")
    else:
        logger.warning("Model file not found - training required")
    
    # Check CORS configuration
    cors_origins = os.getenv("CORS_ORIGINS", "")
    if cors_origins:
        logger.info(f"CORS origins configured: {cors_origins}")
    else:
        logger.info("CORS using defaults (check api/main.py)")
    
    logger.info("=" * 80)
    return True


def start_server():
    """Start Uvicorn server with production configuration."""
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = "0.0.0.0"  # Bind to all interfaces for Render
    
    logger.info(f"Starting Uvicorn on {host}:{port}")
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=False,  # Never reload in production
        access_log=True,
        log_level="info",
    )


if __name__ == "__main__":
    try:
        if validate_environment():
            start_server()
    except Exception as e:
        logger.error(f"Startup failed: {e}", exc_info=True)
        sys.exit(1)
