import mysql.connector
from config import DB_CONFIG


def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


def query_db(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params or ())
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


def query_one(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params or ())
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row
