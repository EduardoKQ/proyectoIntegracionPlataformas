from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection


# api backend health check
def health(request):
    response = {}
    # add backend status
    response["backend-status"] = "ok :)"
    # add database status
    response["database-status"] = check_database()
    return JsonResponse(response)


def check_database():
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result:
                return "ok"
            else:
                return "error"
    except Exception as e:
        return "error: " + str(e)
