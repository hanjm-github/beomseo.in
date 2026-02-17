"""
Pagination helpers.
"""


def parse_pagination(request, default_page=1, default_page_size=10, max_page_size=50):
    page_raw = request.args.get('page', default_page)
    page_size_raw = request.args.get('page_size', request.args.get('pageSize', default_page_size))

    try:
        page = int(page_raw)
    except (ValueError, TypeError):
        page = default_page
    if page < 1:
        page = default_page

    try:
        page_size = int(page_size_raw)
    except (ValueError, TypeError):
        page_size = default_page_size
    if page_size < 1:
        page_size = default_page_size
    if page_size > max_page_size:
        page_size = max_page_size

    return page, page_size


def build_paginated_response(items, total, page, page_size, extra=None):
    payload = {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'pageSize': page_size,
    }
    if extra:
        payload.update(extra)
    return payload
