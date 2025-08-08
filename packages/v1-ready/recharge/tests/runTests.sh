#!/bin/bash

# Run Recharge API tests

echo "🧪 Running Recharge API Tests..."
echo "================================"

# Set environment variables
export NODE_ENV=test
export RECHARGE_API_KEY=${RECHARGE_API_KEY:-"test-api-key-123456789"}

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --save-dev jest ts-jest @types/jest nock @types/node typescript
fi

# Run tests with different configurations

echo -e "\n📋 Running Unit Tests..."
npx jest api.test.ts --config=jest.config.js

echo -e "\n🔗 Running Integration Tests..."
npx jest integration.test.ts --config=jest.config.js

echo -e "\n📊 Running All Tests with Coverage..."
npx jest --coverage --config=jest.config.js

echo -e "\n✅ Tests Complete!"
echo "================================"

# Show coverage summary
if [ -f "coverage/lcov-report/index.html" ]; then
    echo -e "\n📈 Coverage report generated at: coverage/lcov-report/index.html"
fi