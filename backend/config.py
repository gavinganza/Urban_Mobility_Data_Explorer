import os

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'taxi_user'),
    'password': os.environ.get('DB_PASSWORD', 'taxi_pass'),
    'database': os.environ.get('DB_NAME', 'urban_mobility')
}
