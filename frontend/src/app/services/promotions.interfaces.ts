export interface Promotion {
  id: number;
  promotion_code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  max_discount_percentage?: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'expired';
  created_at: string;
  updated_at: string;
  products?: any[];
  categories?: any[];
  subcategories?: any[];
}

export interface CreatePromotionRequest {
  promotion_code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  max_discount_percentage?: number;
  start_date: string;
  end_date: string;
  status?: 'active' | 'inactive';
  product_codes?: string[];
  category_codes?: string[];
  subcategory_codes?: string[];
}

export interface UpdatePromotionRequest {
  name?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  max_discount_percentage?: number;
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'inactive' | 'expired';
  product_codes?: string[];
  category_codes?: string[];
  subcategory_codes?: string[];
}

export interface PromotionProduct {
  promotion: number;
  product: number;
  created_at: string;
}

export interface PromotionCategory {
  promotion: number;
  category: number;
  created_at: string;
}

export interface PromotionSubcategory {
  promotion: number;
  subcategory: number;
  created_at: string;
}

export interface ProductWithPromotion {
  product_id: number;
  product_code: string;
  name: string;
  brand: string;
  description: string;
  image_url: string;
  current_price: number;
  current_price_date: string;
  subcategory: string;

  has_promotion: boolean;
  promotion_info?: {
    promotion_id: number;
    promotion_code: string;
    promotion_name: string;
    original_price: number;
    promotional_price: number;
    discount_amount: number;
    discount_percentage: number;
    discount_type: 'percentage' | 'fixed_amount';
  };
}

export interface OrderItemWithDiscount {
  product_code: string;
  product_name: string;
  product_brand: string;
  quantity: number;
  transaction_price: number;
  original_price?: number;
  promotion_applied: boolean;
  promotion_code?: string;
  promotion_name?: string;
  discount_amount: number;
  discount_percentage: number;
  total_original_price: number;
  total_discount_amount: number;
  total_final_price: number;
}

export interface OrderWithDiscounts {
  order_id: number;
  client_email: string;
  payment_type: string;
  retrieval_type: string;
  shipping_address?: string;
  pickup_branch_name?: string;
  order_status: string;
  creation_date: string;
  delivery_date?: string;
  shipping_cost: number;
  subtotal_original: number;
  total_discount_amount: number;
  subtotal_with_discounts: number;
  total_final: number;
  has_promotions: boolean;
  order_items: OrderItemWithDiscount[];
}

export type PromotionStatus = 'active' | 'inactive' | 'expired';
export type DiscountType = 'percentage' | 'fixed_amount';
