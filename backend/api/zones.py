import json
import os

from flask import Blueprint, jsonify, request
from db import query_db
from utils import clean_rows
from algorithms import rank_zones

zones_bp = Blueprint('zones', __name__)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


@zones_bp.route('/api/zones/top')
def top():
    metric = request.args.get('metric', 'trip_count')
    direction = request.args.get('direction', 'pickup')
    n = min(int(request.args.get('n', 10)), 50)

    location_col = 'pu_location_id' if direction == 'pickup' else 'do_location_id'

    allowed_metrics = {
        'trip_count', 'avg_fare', 'avg_distance',
        'avg_speed', 'avg_tip_pct', 'total_revenue'
    }
    if metric not in allowed_metrics:
        metric = 'trip_count'

    rows = query_db(f"""
        SELECT z.location_id, z.borough, z.zone,
               COUNT(*) as trip_count,
               ROUND(AVG(t.fare_amount), 2) as avg_fare,
               ROUND(AVG(t.trip_distance), 2) as avg_distance,
               ROUND(AVG(t.avg_speed_mph), 2) as avg_speed,
               ROUND(AVG(t.tip_percentage), 2) as avg_tip_pct,
               ROUND(SUM(t.total_amount), 2) as total_revenue
        FROM trips t
        JOIN zones z ON t.{location_col} = z.location_id
        GROUP BY z.location_id, z.borough, z.zone
    """)

    zone_list = clean_rows(rows)
    sorted_zones = rank_zones(zone_list, sort_by=metric, top_n=n)

    return jsonify({
        'zones': sorted_zones,
        'metric': metric,
        'direction': direction
    })


@zones_bp.route('/api/zones/geojson')
def geojson():
    geojson_path = os.path.join(DATA_DIR, 'taxi_zones.geojson')
    with open(geojson_path) as f:
        data = json.load(f)
    return jsonify(data)
