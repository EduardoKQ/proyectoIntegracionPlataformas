from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection
from api.models import WebRoles


# api backend health check
def health(request):
    response = {}
    # add backend status
    response["backend-status"] = "ok"
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


### TESTING ONLY !!! later remove these endpoints
def user_roles(request):
    # get all user roles
    try:
        roles = WebRoles.objects.all().values()
        roles_list = list(roles)
        return JsonResponse({"roles": roles_list}, status=200)

    except WebRoles.DoesNotExist:
        return JsonResponse({"error": "Roles not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
