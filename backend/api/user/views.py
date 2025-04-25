from django.http import JsonResponse
import json
from api.models import WebUser, Client, WebRoles
from .serializer import RegisterClientSerializer, LoginSerializer
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken
from .customJWT import CustomJWTAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated
from django.contrib.auth.hashers import check_password, make_password


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

        # process if the user is first time login
        if user.is_first_time_login:
            is_first_time_login = True
            # update the user to not first time login
            user.is_first_time_login = False
            user.save()
        else:
            is_first_time_login = False

        return login_response(user)
    else:
        return JsonResponse(
            {"status": "error", "message": "Invalid request method."}, status=400
        )


# register
@csrf_exempt
def register_client(request):
    if request.method == "POST":
        # process the registration data with serializer
        data = json.loads(request.body)
        serializer = RegisterClientSerializer(data=data)
        if not serializer.is_valid():
            return JsonResponse(
                {"status": "error", "message": serializer.errors}, status=400
            )
        # if the data is valid, save the user to the database
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = register_new_client(email, password)
        # return the response
        return JsonResponse(
            {
                "status": "success",
                "message": "Usuario registrado con exito.",
                "user_data": user_data(user),
            },
            status=201,
        )
    else:
        return JsonResponse(
            {"status": "error", "message": "Invalid request method."}, status=400
        )


# current user data
def me(request):
    if request.method == "GET":
        try:
            # Extract and validate the JWT token from the Authorization header
            auth = CustomJWTAuthentication()
            auth_result = auth.authenticate(request)

            if auth_result is None:
                raise NotAuthenticated("Invalid or missing token.")

            validated_token = auth_result[1]

            user = validated_token.get("user_id")
            print("user", user)

            # Return user data
            user = WebUser.objects.get(email=user)
            return JsonResponse(
                user_data(user),
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
    refresh["role"] = user_data.role.role

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def login_response(user):
    # generate JWT tokens for the user
    user_tokens = get_user_tokens(user)

    response = JsonResponse(
        {
            "status": "success",
            "message": "Login exitoso.",
            "user_data": user_data(user),
            "tokens": user_tokens,
        },
        status=200,
    )
    return response


def user_data(user):
    if not isinstance(user, WebUser):
        return None
    # get the user data from the database
    user_role = user.role.role
    match user_role:
        case "administrador_tienda":
            return {
                "email": user.email,
                "role": user_role,
                "is_first_time_login": user.is_first_time_login,
            }

        case "cliente":
            # get the client data to check if recieve_offers is true or false
            if not Client.objects.filter(user_account=user).exists():
                return None
            client = Client.objects.get(user_account=user)
            return {
                "email": user.email,
                "role": user_role,
                "recieve_offers": client.recieve_offers,
            }
        case _:
            return {
                "email": user.email,
                "role": user_role,
            }


def register_new_client(email, password, recieve_offers=False):
    # hash the password
    secure_password = make_password(password)
    # create a new user with the given email and password
    user = WebUser(
        email=email,
        password=secure_password,
        role=WebRoles.objects.get(role="cliente"),
    )
    user.is_first_time_login = True
    # create a new client with the given user
    client = Client(user_account=user, recieve_offers=recieve_offers)
    user.save()
    client.save()
    return user
