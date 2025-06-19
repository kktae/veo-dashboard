#!/bin/bash

# ====================================================================
# PostgreSQL Migration Execution Script
# Executes migration_with_data.sql using psql
# ====================================================================

# Configuration - UPDATE THESE VALUES
TARGET_HOST="localhost"
TARGET_PORT="5432"
TARGET_DB="your_database_name"
TARGET_USER="your_username"
MIGRATION_FILE="migration_with_data.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}PostgreSQL Migration Execution Script${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file '$MIGRATION_FILE' not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}Migration Configuration:${NC}"
echo "Host: $TARGET_HOST"
echo "Port: $TARGET_PORT"
echo "Database: $TARGET_DB"
echo "User: $TARGET_USER"
echo "Migration File: $MIGRATION_FILE"
echo ""

# Prompt for confirmation
echo -e "${YELLOW}WARNING: This will modify the target database!${NC}"
echo -e "${YELLOW}Make sure you have backed up your database before proceeding.${NC}"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Starting migration...${NC}"

# Method 1: Direct execution with error handling
echo -e "${BLUE}Executing migration_with_data.sql...${NC}"
if psql -h "$TARGET_HOST" \
        -p "$TARGET_PORT" \
        -U "$TARGET_USER" \
        -d "$TARGET_DB" \
        -v ON_ERROR_STOP=1 \
        --echo-errors \
        -f "$MIGRATION_FILE"; then
    echo -e "${GREEN}✓ Migration completed successfully!${NC}"
else
    echo -e "${RED}✗ Migration failed!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Running validation queries...${NC}"

# Validation queries
echo -e "${YELLOW}Checking record count...${NC}"
psql -h "$TARGET_HOST" \
     -p "$TARGET_PORT" \
     -U "$TARGET_USER" \
     -d "$TARGET_DB" \
     -c "SELECT COUNT(*) as total_records FROM public.videos;"

echo -e "${YELLOW}Checking data sample...${NC}"
psql -h "$TARGET_HOST" \
     -p "$TARGET_PORT" \
     -U "$TARGET_USER" \
     -d "$TARGET_DB" \
     -c "SELECT id, korean_prompt, english_prompt, status FROM public.videos LIMIT 3;"

echo ""
echo -e "${GREEN}Migration process completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify all data is correct"
echo "2. Update your application connection strings"
echo "3. Test your application functionality"
echo "4. Monitor database performance" 