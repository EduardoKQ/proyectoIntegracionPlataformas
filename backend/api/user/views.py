from django.http import JsonResponse
import json
from api.models import WebUser
from .serializer import RegisterSerializer, LoginSerializer
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken
from .customJWT import CustomJWTAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated
from django.contrib.auth.hashers import check_password


# login
@csrf_exempt
def login(request):
    if request.method == "POST":
        # parse the request body as JSON
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse(
                {"status": "error", "message": "Invalid JSON data."}, status=400
            )
        # then validate the data with serializer
        serializer = LoginSerializer(data=data)
        if not serializer.is_valid():
            return JsonResponse(
                {"status": "error", "message": serializer.errors}, status=400
            )

        # if the data is valid, authenticate the user
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        # try to login the user
        try:
            user = WebUser.objects.get(email=email)
            print("user", user)
            print("user.password", user.password)
            print("password", password)

            if not check_password(password, user.password):
                raise AuthenticationFailed("Invalid password.")
        except WebUser.DoesNotExist:
            return JsonResponse(
                {"status": "error", "message": "User not found."}, status=404
            )
        except AuthenticationFailed:
            return JsonResponse(
                {"status": "error", "message": "Invalid email or password."}, status=401
            )
        except Exception as e:
            return JsonResponse(
                {"status": "error", "message": "Invalid email or password."}, status=401
            )

        # if the user is authenticated, generate JWT tokens
        user_tokens = get_user_tokens(user)

        return JsonResponse(
            {
                "status": "success",
                "message": "User logged in successfully.",
                "user_data": {
                    "email": request.POST.get("email"),
                    "password": request.POST.get("password"),
                },
                "JWT_tokens": {
                    "access_token": user_tokens["access"],
                    "refresh_token": user_tokens["refresh"],
                },
            },
            status=200,
        )
    else:
        return JsonResponse(
            {"status": "error", "message": "Invalid request method."}, status=400
        )


# register
def register(request):
    if request.method == "POST":
        # process the registration data with serializer
        serializer = RegisterSerializer(data=request.POST)
        if serializer.is_valid():
            # save the user to the database
            serializer.save()
            return JsonResponse(
                {"status": "success", "message": "User registered successfully."},
                status=201,
            )
        else:
            return JsonResponse(
                {"status": "error", "message": serializer.errors}, status=400
            )


# current user data
@csrf_exempt
def me(request):
    if request.method == "GET":
        try:
            # Extract and validate the JWT token from the Authorization header
            auth = CustomJWTAuthentication()
            auth_result = auth.authenticate(request)

            if auth_result is None:
                raise NotAuthenticated("Invalid or missing token.")

            print("auth_result", auth_result)
            validated_token = auth_result[1]
            print("validated_token", validated_token)

            user = validated_token.get("user_id")
            print("user", user)

            # Return user data
            return JsonResponse(
                {
                    "status": "success",
                    "message": "User data retrieved successfully.",
                    "user_data": {
                        "id": user,
                    },
                },
                status=200,
            )
        except NotAuthenticated as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=401)
        except AuthenticationFailed as e:
            return JsonResponse(
                {"status": "error", "message": f"Authentication Failed: {str(e)}"},
                status=401,
            )
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
    else:
        return JsonResponse(
            {"status": "error", "message": "Invalid request method."}, status=400
        )


# functions
def get_user_tokens(user_data):
    refresh = RefreshToken()

    # crucially, the user_id is set to the refresh token payload
    # this is used to identify the user when the token is validated
    refresh["user_id"] = user_data.email
    refresh["role"] = user_data.role

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }
