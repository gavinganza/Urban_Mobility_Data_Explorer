import os

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'root/1234'),
    'database': os.environ.get('DB_NAME', 'urban_mobility')
}
