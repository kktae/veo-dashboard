# 환경변수 설정
export PGHOST=localhost
export PGPORT=5432
export PGUSER=your_username
export PGDATABASE=your_database
export PGPASSWORD=your_password

psql -f migration_with_data.sql