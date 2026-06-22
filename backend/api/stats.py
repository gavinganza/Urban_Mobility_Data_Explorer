from flask import Blueprint, jsonify
from db import query_db, query_one
from utils import clean_rows

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/api/stats/summary')
def summary():
    row = query_one("""
        SELECT COUNT(*) as total_trips,
               ROUND(AVG(fare_amount), 2) as avg_fare,
               ROUND(AVG(trip_distance), 2) as avg_distance,
               ROUND(AVG(duration_min), 2) as avg_duration,
               ROUND(AVG(tip_percentage), 2) as avg_tip_pct,
               ROUND(AVG(avg_speed_mph), 2) as avg_speed,
               ROUND(SUM(total_amount), 2) as total_revenue
        FROM trips
    """)
    return jsonify(clean_rows([row])[0])


@stats_bp.route('/api/stats/hourly')
def hourly():
    rows = query_db("""
        SELECT HOUR(pickup_datetime) as hour,
               COUNT(*) as trip_count,
               ROUND(AVG(fare_amount), 2) as avg_fare,
               ROUND(AVG(trip_distance), 2) as avg_distance,
               ROUND(AVG(avg_speed_mph), 2) as avg_speed
        FROM trips
        GROUP BY HOUR(pickup_datetime)
        ORDER BY hour
    """)
    return jsonify(clean_rows(rows))


@stats_bp.route('/api/stats/borough')
def borough():
    rows = query_db("""
        SELECT z.borough,
               COUNT(*) as trip_count,
               ROUND(AVG(t.fare_amount), 2) as avg_fare,
               ROUND(AVG(t.trip_distance), 2) as avg_distance,
               ROUND(AVG(t.duration_min), 2) as avg_duration,
               ROUND(AVG(t.avg_speed_mph), 2) as avg_speed,
               ROUND(AVG(t.tip_percentage), 2) as avg_tip_pct
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        GROUP BY z.borough
        ORDER BY trip_count DESC
    """)
    return jsonify(clean_rows(rows))


@stats_bp.route('/api/stats/payments')
def payments():
    rows = query_db("""
        SELECT payment_type,
               CASE payment_type
                   WHEN 1 THEN 'Credit Card'
                   WHEN 2 THEN 'Cash'
                   WHEN 3 THEN 'No Charge'
                   WHEN 4 THEN 'Dispute'
                   WHEN 5 THEN 'Unknown'
                   ELSE 'Other'
               END as payment_name,
               COUNT(*) as trip_count,
               ROUND(AVG(fare_amount), 2) as avg_fare,
               ROUND(AVG(tip_percentage), 2) as avg_tip_pct
        FROM trips
        GROUP BY payment_type
        ORDER BY trip_count DESC
    """)
    return jsonify(clean_rows(rows))
