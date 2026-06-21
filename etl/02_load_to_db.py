import pandas as pd
import mysql.connector
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# --- CONFIG: change these to match your MySQL setup ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root/1234',
    'database': 'urban_mobility'
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZONES_CSV   = os.path.join(BASE_DIR, 'data', 'raw', 'taxi_zone_lookup.csv')
TRIPS_CSV   = os.path.join(BASE_DIR, 'data', 'processed', 'cleaned_trips.csv')
EXCLUDED_CSV = os.path.join(BASE_DIR, 'data', 'logs', 'excluded_records.csv')


def load_zones(cursor, conn):
    logging.info("Loading zones...")
    df = pd.read_csv(ZONES_CSV)
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT IGNORE INTO zones (location_id, borough, zone, service_zone)
            VALUES (%s, %s, %s, %s)
        """, (int(row['LocationID']), row['Borough'], row['Zone'], row['service_zone']))
    conn.commit()
    logging.info(f"Inserted {len(df)} zones.")


def load_trips(cursor, conn):
    logging.info("Loading trips...")
    df = pd.read_csv(TRIPS_CSV)
    inserted = 0
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO trips (
                vendor_id, pickup_datetime, dropoff_datetime, passenger_count,
                trip_distance, pu_location_id, do_location_id, rate_code_id,
                payment_type, fare_amount, tip_amount, total_amount,
                duration_min, avg_speed_mph, tip_percentage, time_of_day
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            row.get('VendorID'), row['tpep_pickup_datetime'], row['tpep_dropoff_datetime'],
            row.get('passenger_count'), row.get('trip_distance'),
            int(row['PULocationID']), int(row['DOLocationID']),
            row.get('RatecodeID'), row.get('payment_type'),
            row.get('fare_amount'), row.get('tip_amount'), row.get('total_amount'),
            row.get('duration_min'), row.get('avg_speed_mph'),
            row.get('tip_percentage'), row.get('time_of_day')
        ))
        inserted += 1
    conn.commit()
    logging.info(f"Inserted {inserted} trips.")


def load_excluded(cursor, conn):
    logging.info("Loading excluded records...")
    df = pd.read_csv(EXCLUDED_CSV)
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO excluded_records (raw_data, exclusion_reason)
            VALUES (%s, %s)
        """, (row.to_json(), 'flagged_by_pipeline'))
    conn.commit()
    logging.info(f"Inserted {len(df)} excluded records.")


if __name__ == "__main__":
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    load_zones(cursor, conn)
    load_trips(cursor, conn)
    load_excluded(cursor, conn)

    cursor.close()
    conn.close()
    logging.info("All data loaded successfully.")