from django.shortcuts import render
from django.http import JsonResponse
from django.db import connection


# api backend health check
def all(request):
    # get all productos
    return JsonResponse({"message": "funciona CTM!"})
