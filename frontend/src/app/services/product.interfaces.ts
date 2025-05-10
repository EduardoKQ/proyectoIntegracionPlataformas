export interface ApiProductPrice {
  precio_actual: number;
  fecha_precio: string;
}
export interface ApiProduct {
  codigo_producto: string;
  nombre: string;
  precio: ApiProductPrice;
  marca: string;
  codigo_marca: string;
  categoria: string;
  subcategoria: string;
  imageUrl: string;
  descripcion: string;
}

export interface CreateProductPayload {
  codigo_producto: string;
  nombre: string;
  precio: number;
  marca: string;
  codigo_marca: string;
  categoria: string;
  subcategoria: string;
  imageUrl?: string;
  descripcion?: string;
}

export interface UpdateProductPayload {
  nombre?: string;
  precio?: number;
  marca?: string;
  codigo_marca?: string;
  categoria?: string;
  subcategoria?: string;
  imageUrl?: string;
  descripcion?: string;
}
