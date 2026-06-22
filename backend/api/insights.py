from flask import Blueprint, jsonify
from db import query_db
from utils import clean_rows

insights_bp = Blueprint('insights', __name__)


@insights_bp.route('/api/insights/tipping')
def tipping():
    rows = query_db("""
        SELECT z.borough, t.time_of_day,
               COUNT(*) as trip_count,
               ROUND(AVG(t.tip_percentage), 2) as avg_tip_pct,
               ROUND(AVG(t.tip_amount), 2) as avg_tip_amount
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        WHERE t.payment_type = 1
        GROUP BY z.borough, t.time_of_day
        ORDER BY z.borough, avg_tip_pct DESC
    """)
    return jsonify(clean_rows(rows))


@insights_bp.route('/api/insights/speed')
def speed():
    rows = query_db("""
        SELECT z.borough,
               HOUR(t.pickup_datetime) as hour,
               COUNT(*) as trip_count,
               ROUND(AVG(t.avg_speed_mph), 2) as avg_speed
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        GROUP BY z.borough, HOUR(t.pickup_datetime)
        ORDER BY z.borough, hour
    """)
    return jsonify(clean_rows(rows))


@insights_bp.route('/api/insights/distance-economics')
def distance_economics():
    rows = query_db("""
        SELECT
            CASE
                WHEN trip_distance < 1 THEN '0-1 mi'
                WHEN trip_distance < 2 THEN '1-2 mi'
                WHEN trip_distance < 5 THEN '2-5 mi'
                WHEN trip_distance < 10 THEN '5-10 mi'
                ELSE '10+ mi'
            END as distance_bucket,
            COUNT(*) as trip_count,
            ROUND(AVG(fare_amount), 2) as avg_fare,
            ROUND(AVG(fare_amount / NULLIF(trip_distance, 0)), 2) as fare_per_mile,
            ROUND(AVG(duration_min), 2) as avg_duration,
            ROUND(AVG(total_amount), 2) as avg_total
        FROM trips
        GROUP BY distance_bucket
        ORDER BY MIN(trip_distance)
    """)
    return jsonify(clean_rows(rows))
