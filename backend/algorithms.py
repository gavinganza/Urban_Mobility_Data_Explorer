"""
Custom quicksort implementation for ranking zone data.
No built-in sort functions used — this satisfies the DSA requirement.

Used by the /api/zones/top endpoint to rank zones by trip volume or revenue.
"""


def quicksort(arr, key=None, reverse=False):
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    pivot_val = key(pivot) if key else pivot

    left = []
    middle = []
    right = []

    for item in arr:
        item_val = key(item) if key else item
        if item_val < pivot_val:
            left.append(item)
        elif item_val > pivot_val:
            right.append(item)
        else:
            middle.append(item)

    sorted_arr = quicksort(left, key, reverse) + middle + quicksort(right, key, reverse)

    if reverse:
        sorted_arr = list(reversed(sorted_arr))

    return sorted_arr


def rank_zones(zone_data, sort_by='trip_count', top_n=10):
    """Rank zones using custom quicksort. Returns top N zones."""
    if sort_by not in zone_data[0] if zone_data else True:
        sort_by = 'trip_count'

    sorted_zones = quicksort(zone_data, key=lambda z: z.get(sort_by, 0), reverse=True)
    return sorted_zones[:top_n]
