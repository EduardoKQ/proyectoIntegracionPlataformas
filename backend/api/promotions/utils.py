from django.http import JsonResponse
from django.utils import timezone
from .models import Promotion, PromotionProduct, PromotionCategory, PromotionSubcategory
from .serializers import PromotionCreateSerializer, PromotionDetailSerializer, PromotionListSerializer
from api.models import Product, Category, Subcategory
from decimal import Decimal
import json

def get_request_data(request):
    """Helper function to get JSON data from request"""
    try:
        return json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}

def process_promotion_list_get(request):
    """Obtener lista de promociones"""
    try:
        status_filter = request.GET.get("status", None)
        active_only = request.GET.get("active_only", "false").lower() == "true"
        include_details = request.GET.get("include_details", "false").lower() == "true"
        promotions = Promotion.objects.all()
        if status_filter:
            promotions = promotions.filter(status=status_filter)
        if active_only:
            now = timezone.now()
            promotions = promotions.filter(
                status='active',
                start_date__lte=now,
                end_date__gte=now
            )
        if include_details:
            serializer = PromotionDetailSerializer(promotions, many=True)
        else:
            serializer = PromotionListSerializer(promotions, many=True)
            
        return JsonResponse(serializer.data, safe=False, status=200)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_create_post(request):
    """Crear nueva promoción"""
    try:
        
        # Obtener datos JSON del request
        data = get_request_data(request)
        print(f"DEBUG - Datos recibidos en backend: {data}")
        print(f"DEBUG - Tipo de promotion_code: {type(data.get('promotion_code', 'NOT_FOUND'))}")
        print(f"DEBUG - Valor de promotion_code: {data.get('promotion_code', 'NOT_FOUND')}")
        
        serializer = PromotionCreateSerializer(data=data)
        if not serializer.is_valid():
            print(f"DEBUG - Errores de validación: {serializer.errors}")
            return JsonResponse(serializer.errors, status=400)
        
        product_ids = serializer.validated_data.pop('product_ids', [])
        category_ids = serializer.validated_data.pop('category_ids', [])
        subcategory_ids = serializer.validated_data.pop('subcategory_ids', [])
        
        promotion = serializer.save()
        
        for product_id in product_ids:
            try:
                product = Product.objects.get(product_code=product_id)
                PromotionProduct.objects.create(promotion=promotion, product=product)
            except Product.DoesNotExist:
                continue
        
        for category_id in category_ids:
            try:
                category = Category.objects.get(category_code=category_id)
                PromotionCategory.objects.create(promotion=promotion, category=category)
            except Category.DoesNotExist:
                continue
        
        for subcategory_id in subcategory_ids:
            try:
                subcategory = Subcategory.objects.get(subcategory_code=subcategory_id)
                PromotionSubcategory.objects.create(promotion=promotion, subcategory=subcategory)
            except Subcategory.DoesNotExist:
                continue
        
        detail_serializer = PromotionDetailSerializer(promotion)
        return JsonResponse(detail_serializer.data, status=201)
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_detail_get(request, promotion_code):
    """Obtener detalle de una promoción por promotion_code"""
    try:
        promotion = Promotion.objects.get(promotion_code=promotion_code)
        serializer = PromotionDetailSerializer(promotion)
        return JsonResponse(serializer.data, status=200)
        
    except Promotion.DoesNotExist:
        return JsonResponse(
            {"error": f"Promoción con código '{promotion_code}' no encontrada"}, 
            status=404
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_update_put(request, promotion_code):
    """Actualizar promoción por promotion_code"""
    try:
        promotion = Promotion.objects.get(promotion_code=promotion_code)
        
        data = get_request_data(request)
        if not data:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        
        if 'promotion_code' in data and data['promotion_code'] != promotion_code:
            new_code = data['promotion_code']
            if Promotion.objects.filter(promotion_code=new_code).exclude(id=promotion.id).exists():
                return JsonResponse(
                    {"error": f"El código de promoción '{new_code}' ya está en uso"}, 
                    status=400
                )
        
        serializer = PromotionCreateSerializer(promotion, data=data, partial=True)
        
        if not serializer.is_valid():
            return JsonResponse(serializer.errors, status=400)
        
        product_ids = serializer.validated_data.pop('product_ids', None)
        category_ids = serializer.validated_data.pop('category_ids', None)
        subcategory_ids = serializer.validated_data.pop('subcategory_ids', None)
        
        promotion = serializer.save()
        
        if product_ids is not None:
            PromotionProduct.objects.filter(promotion=promotion).delete()
            for product_id in product_ids:
                try:
                    product = Product.objects.get(product_code=product_id)
                    PromotionProduct.objects.create(promotion=promotion, product=product)
                except Product.DoesNotExist:
                    continue
        
        if category_ids is not None:
            PromotionCategory.objects.filter(promotion=promotion).delete()
            for category_id in category_ids:
                try:
                    category = Category.objects.get(category_code=category_id)
                    PromotionCategory.objects.create(promotion=promotion, category=category)
                except Category.DoesNotExist:
                    continue
        
        if subcategory_ids is not None:
            PromotionSubcategory.objects.filter(promotion=promotion).delete()
            for subcategory_id in subcategory_ids:
                try:
                    subcategory = Subcategory.objects.get(subcategory_code=subcategory_id)
                    PromotionSubcategory.objects.create(promotion=promotion, subcategory=subcategory)
                except Subcategory.DoesNotExist:
                    continue
        
        detail_serializer = PromotionDetailSerializer(promotion)
        return JsonResponse(detail_serializer.data, status=200)
        
    except Promotion.DoesNotExist:
        return JsonResponse(
            {"error": f"Promoción con código '{promotion_code}' no encontrada"}, 
            status=404
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_delete(request, promotion_code):
    """Eliminar promoción por promotion_code"""
    try:
        promotion = Promotion.objects.get(promotion_code=promotion_code)
        promotion_name = promotion.name
        promotion.delete()
        return JsonResponse(
            {"message": f"Promoción '{promotion_name}' eliminada correctamente"}, 
            status=200
        )
        
    except Promotion.DoesNotExist:
        return JsonResponse(
            {"error": f"Promoción con código '{promotion_code}' no encontrada"}, 
            status=404
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_detail_get_by_id(request, promotion_id):
    """Obtener detalle de promoción por ID"""
    try:
        promotion = Promotion.objects.get(id=promotion_id)
        serializer = PromotionDetailSerializer(promotion)
        return JsonResponse(serializer.data, status=200)
    except Promotion.DoesNotExist:
        return JsonResponse({"error": "Promoción no encontrada"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_update_put_by_id(request, promotion_id):
    """Actualizar promoción por ID"""
    try:
        promotion = Promotion.objects.get(id=promotion_id)
        
        data = get_request_data(request)
        if not data:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        
        if 'promotion_code' in data:
            new_code = data['promotion_code']
            if Promotion.objects.filter(promotion_code=new_code).exclude(id=promotion.id).exists():
                return JsonResponse(
                    {"error": f"El código de promoción '{new_code}' ya está en uso"}, 
                    status=400
                )
        
        serializer = PromotionCreateSerializer(promotion, data=data, partial=True)
        if serializer.is_valid():
            promotion = serializer.save()
            product_ids = data.get('product_ids')
            category_ids = data.get('category_ids')  
            subcategory_ids = data.get('subcategory_ids')
            
            if product_ids is not None:
                PromotionProduct.objects.filter(promotion=promotion).delete()
                for product_id in product_ids:
                    try:
                        product = Product.objects.get(product_code=product_id)
                        PromotionProduct.objects.create(promotion=promotion, product=product)
                    except Product.DoesNotExist:
                        continue
            
            if category_ids is not None:
                PromotionCategory.objects.filter(promotion=promotion).delete()
                for category_id in category_ids:
                    try:
                        category = Category.objects.get(category_code=category_id)
                        PromotionCategory.objects.create(promotion=promotion, category=category)
                    except Category.DoesNotExist:
                        continue
            
            if subcategory_ids is not None:
                PromotionSubcategory.objects.filter(promotion=promotion).delete()
                for subcategory_id in subcategory_ids:
                    try:
                        subcategory = Subcategory.objects.get(subcategory_code=subcategory_id)
                        PromotionSubcategory.objects.create(promotion=promotion, subcategory=subcategory)
                    except Subcategory.DoesNotExist:
                        continue
            detail_serializer = PromotionDetailSerializer(promotion)
            return JsonResponse(detail_serializer.data, status=200)
        else:
            return JsonResponse({"errors": serializer.errors}, status=400)
            
    except Promotion.DoesNotExist:
        return JsonResponse({"error": "Promoción no encontrada"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def process_promotion_delete_by_id(request, promotion_id):
    """Eliminar promoción por ID"""
    try:
        promotion = Promotion.objects.get(id=promotion_id)
        promotion_name = promotion.name
        promotion.delete()
        return JsonResponse({
            "message": f"Promoción '{promotion_name}' eliminada exitosamente"
        }, status=200)
    except Promotion.DoesNotExist:
        return JsonResponse({"error": "Promoción no encontrada"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def calculate_product_discount(product, original_price):
    """Calcular el descuento aplicable a un producto"""
    now = timezone.now()
    best_discount = Decimal('0.00')
    applied_promotion = None
    
    product_promotions = PromotionProduct.objects.filter(
        product=product,
        promotion__status='active',
        promotion__start_date__lte=now,
        promotion__end_date__gte=now
    ).select_related('promotion')
    
    for promo_product in product_promotions:
        discount = calculate_discount_amount(promo_product.promotion, original_price)
        if discount > best_discount:
            best_discount = discount
            applied_promotion = promo_product.promotion
    
    if hasattr(product, 'subcategory') and product.subcategory and hasattr(product.subcategory, 'category'):
        category_promotions = PromotionCategory.objects.filter(
            category=product.subcategory.category,
            promotion__status='active',
            promotion__start_date__lte=now,
            promotion__end_date__gte=now
        ).select_related('promotion')
        
        for promo_category in category_promotions:
            discount = calculate_discount_amount(promo_category.promotion, original_price)
            if discount > best_discount:
                best_discount = discount
                applied_promotion = promo_category.promotion
    
    if hasattr(product, 'subcategory') and product.subcategory:
        subcategory_promotions = PromotionSubcategory.objects.filter(
            subcategory=product.subcategory,
            promotion__status='active',
            promotion__start_date__lte=now,
            promotion__end_date__gte=now
        ).select_related('promotion')
        
        for promo_subcategory in subcategory_promotions:
            discount = calculate_discount_amount(promo_subcategory.promotion, original_price)
            if discount > best_discount:
                best_discount = discount
                applied_promotion = promo_subcategory.promotion
    
    return {
        'discount_amount': best_discount,
        'final_price': original_price - best_discount,
        'promotion': applied_promotion
    }

def calculate_discount_amount(promotion, original_price):
    """Calcular el monto del descuento según el tipo de promoción"""
    if promotion.discount_type == 'percentage':
        discount = original_price * (promotion.discount_value / Decimal('100'))
        if promotion.max_discount_percentage:
            max_discount = original_price * (promotion.max_discount_percentage / Decimal('100'))
            return min(discount, max_discount)
        return discount
    elif promotion.discount_type == 'fixed_amount':
        return min(promotion.discount_value, original_price)
    return Decimal('0.00')

def get_promotion_by_code(promotion_code):
    """Obtener promoción por código (función helper)"""
    try:
        return Promotion.objects.get(promotion_code=promotion_code)
    except Promotion.DoesNotExist:
        return None

def validate_promotion_code_unique(promotion_code, exclude_id=None):
    """Validar que el código de promoción sea único"""
    query = Promotion.objects.filter(promotion_code=promotion_code)
    if exclude_id:
        query = query.exclude(id=exclude_id)
    return not query.exists()

def get_active_promotions_for_product(product):
    """Obtener todas las promociones activas aplicables a un producto específico"""
    now = timezone.now()
    active_promotions = []
    
    product_promotions = PromotionProduct.objects.filter(
        product=product,
        promotion__status='active',
        promotion__start_date__lte=now,
        promotion__end_date__gte=now
    ).select_related('promotion')
    
    for promo_product in product_promotions:
        active_promotions.append(promo_product.promotion)
    
    if hasattr(product, 'subcategory') and product.subcategory and hasattr(product.subcategory, 'category'):
        category_promotions = PromotionCategory.objects.filter(
            category=product.subcategory.category,
            promotion__status='active',
            promotion__start_date__lte=now,
            promotion__end_date__gte=now
        ).select_related('promotion')
        
        for promo_category in category_promotions:
            if promo_category.promotion not in active_promotions:
                active_promotions.append(promo_category.promotion)
    
    if hasattr(product, 'subcategory') and product.subcategory:
        subcategory_promotions = PromotionSubcategory.objects.filter(
            subcategory=product.subcategory,
            promotion__status='active',
            promotion__start_date__lte=now,
            promotion__end_date__gte=now
        ).select_related('promotion')
        
        for promo_subcategory in subcategory_promotions:
            if promo_subcategory.promotion not in active_promotions:
                active_promotions.append(promo_subcategory.promotion)
    
    return active_promotions