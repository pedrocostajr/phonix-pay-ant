// PRODUCT_CONFIG - Única fonte da verdade do sistema
// Para atualizar, use o Painel Admin e cole o JSON gerado aqui

export interface ProductConfig {
  id: string;
  name: string;
  description: string;
  price: number; // em centavos
  originalPrice?: number; // preço riscado (centavos)
  accentColor: string; // HSL values: "H S% L%"
  buttonGradientStart: string;
  buttonGradientEnd: string;
  pixDiscount: number; // percentual de desconto no PIX
  bannerUrl?: string; // URL do banner opcional
}

export const PRODUCT_CONFIG: ProductConfig = {
  id: "phoenix-001",
  name: "Curso Completo Phoenix",
  description: "Acesso vitalício + Bônus exclusivos",
  price: 9700, // R$ 97,00
  originalPrice: 29700, // R$ 297,00
  accentColor: "142 76% 36%", // Verde esmeralda
  buttonGradientStart: "142 76% 36%",
  buttonGradientEnd: "142 76% 28%",
  pixDiscount: 10, // 10% de desconto no PIX
};

// Formatador de moeda brasileira
export const formatBRL = (cents: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

// Calcula preço com desconto PIX
export const getPixPrice = (config: ProductConfig): number => {
  return Math.round(config.price * (1 - config.pixDiscount / 100));
};
