from decimal import Decimal
from datetime import datetime, date


def serialize(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj


def clean_rows(rows):
    return [{k: serialize(v) for k, v in row.items()} for row in rows]
