import pandas as pd
import numpy as np
import os
import logging
from datetime import datetime

# Setup basic logging to console
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def process_taxi_data(input_file, output_file, log_file, lookup_file):
    logging.info(f"Starting ETL process for: {input_file}")
    
    # 1. LOAD DATA
    # We load the raw trip data. For massive files, you can use the 'nrows' parameter to test.
    df = pd.read_csv(input_file)
    original_count = len(df)
    logging.info(f"Loaded {original_count} rows.")

    # 2. DATA INTEGRITY & CLEANING
    # Convert timestamps to actual datetime objects
    df['tpep_pickup_datetime'] = pd.to_datetime(df['tpep_pickup_datetime'])
    df['tpep_dropoff_datetime'] = pd.to_datetime(df['tpep_dropoff_datetime'])

    # Tag and exclude bad records with specific reasons
    excluded_parts = []

    bad_passengers = df['passenger_count'] <= 0
    excluded_parts.append(df[bad_passengers].assign(exclusion_reason='zero_or_negative_passengers'))

    bad_distance = (~bad_passengers) & (df['trip_distance'] <= 0)
    excluded_parts.append(df[bad_distance].assign(exclusion_reason='zero_or_negative_distance'))

    bad_fare = (~bad_passengers) & (~bad_distance) & (df['fare_amount'] <= 0)
    excluded_parts.append(df[bad_fare].assign(exclusion_reason='zero_or_negative_fare'))

    bad_time = (~bad_passengers) & (~bad_distance) & (~bad_fare) & (df['tpep_dropoff_datetime'] <= df['tpep_pickup_datetime'])
    excluded_parts.append(df[bad_time].assign(exclusion_reason='invalid_timestamps'))

    all_bad = bad_passengers | bad_distance | bad_fare | bad_time
    clean_df = df[~all_bad].copy()

    # Filter out illogical years (e.g., data from 2008 in a 2019 dataset)
    # The dataset is for Jan 2019, so keep late Dec 2018 and Jan 2019
    year_mask = clean_df['tpep_pickup_datetime'].dt.year.isin([2018, 2019])
    excluded_parts.append(clean_df[~year_mask].assign(exclusion_reason='invalid_year'))
    clean_df = clean_df[year_mask]

    logging.info(f"Removed {sum(len(p) for p in excluded_parts)} anomalous records.")

    # 3. FEATURE ENGINEERING (3 Derived Features)
    logging.info("Engineering new features...")

    # Feature 1: Trip Duration in Minutes (needed for speed)
    clean_df['duration_min'] = (clean_df['tpep_dropoff_datetime'] - clean_df['tpep_pickup_datetime']).dt.total_seconds() / 60.0

    # Feature 2: Average Speed (mph)
    # Handle potential division by zero just in case, though we filtered out 0 duration above
    clean_df['avg_speed_mph'] = clean_df['trip_distance'] / (clean_df['duration_min'] / 60.0)

    # Filter out impossible speeds (e.g., > 100 mph in NYC)
    speed_mask = clean_df['avg_speed_mph'] <= 100
    excluded_parts.append(clean_df[~speed_mask].assign(exclusion_reason='impossible_speed'))
    clean_df = clean_df[speed_mask]

    # Feature 3: Tip Percentage
    # (Tip Amount / Total Fare) * 100. If total amount is 0, make it 0 to avoid NaN
    clean_df['tip_percentage'] = np.where(
        clean_df['total_amount'] > 0, 
        (clean_df['tip_amount'] / clean_df['total_amount']) * 100, 
        0
    )

    # Feature 4: Time-of-Day Category
    def get_time_of_day(hour):
        if 6 <= hour < 10: return 'Morning Rush'
        elif 10 <= hour < 16: return 'Midday'
        elif 16 <= hour < 20: return 'Evening Rush'
        else: return 'Late Night'
        
    clean_df['time_of_day'] = clean_df['tpep_pickup_datetime'].dt.hour.apply(get_time_of_day)

    # 4. DATA INTEGRATION (Join with Lookup Table)
    # (Optional but good practice to verify LocationIDs exist in the dimension table)
    logging.info("Verifying zone lookups...")
    zones_df = pd.read_csv(lookup_file)
    zones_df['Borough'] = zones_df['Borough'].fillna('Outside NYC').replace('', 'Outside NYC')
    valid_zones = zones_df['LocationID'].unique()
    
    # Ensure PU and DO locations exist in our shapefiles/lookup
    zone_mask = clean_df['PULocationID'].isin(valid_zones) & clean_df['DOLocationID'].isin(valid_zones)
    excluded_parts.append(clean_df[~zone_mask].assign(exclusion_reason='invalid_zone'))
    clean_df = clean_df[zone_mask]

    # 5. SAVE OUTPUTS
    logging.info("Saving cleaned data and exclusion logs...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    excluded_df = pd.concat(excluded_parts, ignore_index=True)

    clean_df.to_csv(output_file, index=False)
    excluded_df.to_csv(log_file, index=False)

    logging.info(f"ETL Complete. Final clean records: {len(clean_df)} (Dropped: {len(excluded_df)})")
    logging.info("Exclusion breakdown:")
    for reason, count in excluded_df['exclusion_reason'].value_counts().items():
        logging.info(f"  {reason}: {count}")


if _name_ == "_main_":
    # Define file paths based on the project structure
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(_file_)))
    
    INPUT_CSV = os.path.join(BASE_DIR, 'data', 'raw', 'yellow_tripdata_2019-01.csv')
    
    LOOKUP_CSV = os.path.join(BASE_DIR, 'data', 'raw', 'taxi_zone_lookup.csv')
    OUTPUT_CSV = os.path.join(BASE_DIR, 'data', 'processed', 'cleaned_trips.csv')
    LOG_CSV = os.path.join(BASE_DIR, 'data', 'logs', 'excluded_records.csv')

    process_taxi_data(INPUT_CSV, OUTPUT_CSV, LOG_CSV, LOOKUP_CSV)