# NYC Taxi Mobility Dashboard

An enterprise-level full-stack web application designed to process, store, and visualize millions of real-world New York City taxi records to derive urban mobility insights. 

## Features
* **Custom ETL Pipeline:** Processes massive `.parquet`/`.csv` datasets, engineers spatial-temporal features, and filters physical/logical anomalies with a strict transparency logging system.
* **Normalized Relational Database:** Utilizes a highly indexed MySQL star schema to handle rapid aggregate querying.
* **Algorithmic Ranking:** Features a manually implemented Quicksort algorithm to dynamically rank borough hotspots by varying economic metrics.
* **Interactive Frontend UI:** Built with HTML/CSS/Vanilla JS, featuring Chart.js analytics and Leaflet.js choropleth mapping.

## Technology Stack
* **Database:** MySQL
* **Backend:** Python, Flask, `mysql-connector-python`
* **Data Engineering:** Pandas, NumPy
* **Frontend:** HTML5, CSS3, JavaScript, Chart.js, Leaflet.js

## Demo

[Watch the demo on Loom](https://www.loom.com/share/888c423385ba4a7094ef6efd08aa1ce4)

## How to Run Locally

### 1. Database Setup
Ensure MySQL is running, then execute the schema:
```bash
mysql -u root -p < database/schema.sql