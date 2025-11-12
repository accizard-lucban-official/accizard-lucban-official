#!/bin/bash
# Bash script for building with production environment variables
# Usage: ./build-production.sh

echo "Building for production..."

# Check if .env.production exists
if [ -f .env.production ]; then
    echo "Found .env.production file. Loading variables..."
    
    # Export variables from .env.production
    export $(grep -v '^#' .env.production | xargs)
    
    echo "Variables loaded."
else
    echo "Warning: .env.production not found!"
    echo "Please create .env.production with your Firebase config values."
    echo "You can copy .env.example and fill in the values."
    exit 1
fi

# Build the project
echo ""
echo "Running npm run build..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful! You can now deploy with: firebase deploy --only hosting"
else
    echo ""
    echo "Build failed! Check the errors above."
    exit 1
fi

