# NYC Taxi Mobility Dashboard

A full-stack web application that processes, stores, and visualizes New York City taxi records for urban mobility insights.

## Features

- **ETL Pipeline:** Cleans raw taxi trip CSVs, engineers features (duration, speed, tip %, time-of-day), logs exclusions.
- **MySQL Database:** Indexed star schema for fast aggregate queries.
- **Custom Quicksort:** Ranks borough hotspots by economic metrics.
- **Interactive Dashboard:** Chart.js analytics and Leaflet.js choropleth maps.

## Tech Stack

- Python 3.10+ Flask 
- MySQL 8+ 
- Pandas 
-Chart.js 
- Leaflet.js

## Demo

[Watch on Loom](https://www.loom.com/share/888c423385ba4a7094ef6efd08aa1ce4)

## Setup

**1. Install dependencies**
```bash
pip install pandas numpy
pip install -r backend/requirements.txt
```

**2. Get the data**

Download from [NYC TLC](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page) and place in `data/raw/`:
- `yellow_tripdata_2019-01.csv`
- `taxi_zone_lookup.csv`

**3. Set up MySQL**
```bash
mysql -u root -p < database/schema.sql
```
```sql
CREATE USER 'taxi_user'@'localhost' IDENTIFIED BY 'taxi_pass';
GRANT ALL PRIVILEGES ON urban_mobility.* TO 'taxi_user'@'localhost';
FLUSH PRIVILEGES;
```

**4. Run ETL**
```bash
python etl/01_clean_data.py
python etl/02_load_to_db.py
```

**5. Start the app**
```bash
<<<<<<< HEAD
python backend/app.py
```
Open [http://localhost:5000](http://localhost:5000).
=======
mysql -u root -p < database/schema.sql

Team Task sheet link: https://docs.google.com/spreadsheets/d/1abVbT6YdxCkYFyABA0_KdDv-Qfuk_M2h8OfQ4FtPgKM/edit?gid=0#gid=0
>>>>>>> Readme update
