from flask import Blueprint, jsonify, request
from db import query_db, query_one
from utils import clean_rows

trips_bp = Blueprint('trips', __name__)


@trips_bp.route('/api/trips')
def get_trips():
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 50)), 200)
    borough = request.args.get('borough')
    time_of_day = request.args.get('time_of_day')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    sort_by = request.args.get('sort_by', 'pickup_datetime')
    order = request.args.get('order', 'desc')

    allowed_sorts = {
        'pickup_datetime', 'trip_distance', 'fare_amount',
        'total_amount', 'duration_min', 'avg_speed_mph', 'tip_percentage'
    }
    if sort_by not in allowed_sorts:
        sort_by = 'pickup_datetime'
    if order not in ('asc', 'desc'):
        order = 'desc'

    conditions = []
    params = []

    if borough:
        conditions.append('z.borough = %s')
        params.append(borough)
    if time_of_day:
        conditions.append('t.time_of_day = %s')
        params.append(time_of_day)
    if date_from:
        conditions.append('t.pickup_datetime >= %s')
        params.append(date_from)
    if date_to:
        conditions.append('t.pickup_datetime <= %s')
        params.append(date_to)

    where = 'WHERE ' + ' AND '.join(conditions) if conditions else ''
    offset = (page - 1) * per_page

    count_sql = f"""
        SELECT COUNT(*) as total
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        {where}
    """
    total = query_one(count_sql, params)['total']

    sql = f"""
        SELECT t.trip_id, t.pickup_datetime, t.dropoff_datetime,
               t.passenger_count, t.trip_distance, t.fare_amount,
               t.tip_amount, t.total_amount, t.duration_min,
               t.avg_speed_mph, t.tip_percentage, t.time_of_day,
               t.payment_type, z.borough, z.zone as pickup_zone
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        {where}
        ORDER BY t.{sort_by} {order}
        LIMIT %s OFFSET %s
    """
    params.extend([per_page, offset])
    rows = query_db(sql, params)

    return jsonify({
        'trips': clean_rows(rows),
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })
