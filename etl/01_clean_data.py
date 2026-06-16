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

    # Identify valid records
    valid_conditions = (
        (df['passenger_count'] > 0) &                            # Must have passengers
        (df['trip_distance'] > 0) &                              # Must have traveled some distance
        (df['fare_amount'] > 0) &                                # Fare must be positive
        (df['tpep_dropoff_datetime'] > df['tpep_pickup_datetime']) # Dropoff must be AFTER pickup
    )

    # Separate good data from bad data (to keep a log of exclusions)
    clean_df = df[valid_conditions].copy()
    excluded_df = df[~valid_conditions].copy()
    
    # Filter out illogical years (e.g., data from 2008 in a 2019 dataset)
    # The dataset is for Jan 2019, so keep late Dec 2018 and Jan 2019
    year_mask = clean_df['tpep_pickup_datetime'].dt.year.isin([2018, 2019])
    excluded_df = pd.concat([excluded_df, clean_df[~year_mask]])
    clean_df = clean_df[year_mask]

    logging.info(f"Removed {len(excluded_df)} anomalous records.")

    # 3. FEATURE ENGINEERING (3 Derived Features)
    logging.info("Engineering new features...")

    # Feature 1: Trip Duration in Minutes (needed for speed)
    clean_df['duration_min'] = (clean_df['tpep_dropoff_datetime'] - clean_df['tpep_pickup_datetime']).dt.total_seconds() / 60.0

    # Feature 2: Average Speed (mph)
    # Handle potential division by zero just in case, though we filtered out 0 duration above
    clean_df['avg_speed_mph'] = clean_df['trip_distance'] / (clean_df['duration_min'] / 60.0)
    
    # Filter out impossible speeds (e.g., > 100 mph in NYC)
    speed_mask = clean_df['avg_speed_mph'] <= 100
    excluded_df = pd.concat([excluded_df, clean_df[~speed_mask]])
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
    valid_zones = zones_df['LocationID'].unique()
    
    # Ensure PU and DO locations exist in our shapefiles/lookup
    zone_mask = clean_df['PULocationID'].isin(valid_zones) & clean_df['DOLocationID'].isin(valid_zones)
    excluded_df = pd.concat([excluded_df, clean_df[~zone_mask]])
    clean_df = clean_df[zone_mask]

    # 5. SAVE OUTPUTS
    logging.info("Saving cleaned data and exclusion logs...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    # Save clean data
    clean_df.to_csv(output_file, index=False)
    # Save excluded records to a log file
    excluded_df.to_csv(log_file, index=False)

    logging.info(f"ETL Complete. Final clean records: {len(clean_df)} (Dropped: {len(excluded_df)})")


if __name__ == "__main__":
    # Define file paths based on the project structure
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Change these paths depending on what you are testing
    INPUT_CSV = os.path.join(BASE_DIR, 'data', 'raw', 'sample_10k.csv') # TEST WITH THIS FIRST
    # INPUT_CSV = os.path.join(BASE_DIR, 'data', 'raw', 'yellow_tripdata_2019-01.csv') # USE THIS FOR FINAL
    
    LOOKUP_CSV = os.path.join(BASE_DIR, 'data', 'raw', 'taxi_zone_lookup.csv')
    OUTPUT_CSV = os.path.join(BASE_DIR, 'data', 'processed', 'cleaned_trips.csv')
    LOG_CSV = os.path.join(BASE_DIR, 'data', 'logs', 'excluded_records.csv')

    process_taxi_data(INPUT_CSV, OUTPUT_CSV, LOG_CSV, LOOKUP_CSV)